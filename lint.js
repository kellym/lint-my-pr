#!/usr/bin/env node

const path          = require('path'),
      parse         = require('parse-diff'),
      { CLIEngine } = require('eslint'),
      { argv }      = require('yargs'),
      octokit       = require('@octokit/rest')(),
      debug         = require('debug')('lint-my-pr');

const lintPath = argv.path || '.';
const stripPath = path.resolve(lintPath);

const { slug, pr, dry, token } = argv;
const number = pr;
const [owner, repo] = slug.split('/');

const errors = {};
let errorCount = 0;
const comments = {};

const cli = new CLIEngine({
  useEslintrc: true
});
const report = cli.executeOnFiles([lintPath]);

// compile list of errors
report.results.forEach(err => {
  const file = err.filePath.replace(stripPath + '/', '');
  errors[file] = errors[file] || [];
  err.messages.forEach(msg => {
    errors[file].push(msg);
    debug(`Error on line ${msg.line}: ${msg.message}`);
    errorCount++;
  });
});

if (!errorCount) {
  process.exit();
}
octokit.authenticate({
  type: 'token',
  token: token || process.env.GH_TOKEN
});

// get PR diff
octokit.pulls.get({
  owner,
  repo,
  number,
  headers: {
    accept: 'application/vnd.github.v3.diff'
  }
}).then(response => {

  const diffFiles = parse(response.data);
  diffFiles.forEach(file => {
    if (errors[file.to]) {
      const fileErrors = {};
      errors[file.to].forEach(({ line, message }) => {
        let position = 1;
        file.chunks.forEach(chunk => {
          // if this chunk houses the line with the error, track it
          if (line >= chunk.newStart && line <= (chunk.newStart + chunk.newLines)) {
            // now we have to find the actual position based on add/del.
            let errorPosition = position + (line - chunk.newStart);
            for (let i = 0; i < chunk.changes.length; i++) {
              const change = chunk.changes[i];
              if ((change.ln2 || change.ln) > errorPosition) break;
              if (change.del) errorPosition++;
            }
            fileErrors[errorPosition] = fileErrors[errorPosition] || [];
            fileErrors[errorPosition].push(message);
          }
          position += chunk.newLines;
        });
      });
      comments[file.to] = fileErrors;
    }
  });

  const apiCalls = []
  // get the PR again in regular format
  octokit.pulls.get({ owner, repo, number }).then(({ data }) => {
    // we need the latest commit so our comments are tracked
    const commit_id = data.head.sha;
    octokit.pulls.listComments({ owner, repo, number }).then(response => {
      const listCommentsData = response.data;
      // loop through each path in the comments
      Object.keys(comments).forEach(path => {
        // then loop through each line number with errors
        Object.keys(comments[path]).forEach(position => {
          // if there's no existing comment with the same message, add it.
          const existingComment = listCommentsData.find(c => c.path == path && c.position == position);
          const body = comments[path][position].join(' ');
          if (!existingComment || existingComment.body != body) {
            apiCalls.push({ owner, repo, number, body, commit_id, path, position });
          }
        });
      });

      function create() {
        if (apiCalls.length) {
          const comment = apiCalls.pop();
          debug(`Creating comment: ${JSON.stringify(comment)}`);
          octokit.pulls.createComment(comment).then(() => {
            setTimeout(create, 1000);
          }).catch(e => {
            debug(`Error creating comment: ${JSON.stringify(e)}`);
          })
        }
      }
      // now actually go through and create comments at a rate of 1 per second
      if (!dry) create();


    });

  });

}).catch(e => {
  debug(`Couldn't authenticate: ${JSON.stringify(e)}`);
});

