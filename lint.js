const { CLIEngine } = require('eslint');
const path = require('path');
const octokit = require('@octokit/rest')();
const parse = require('parse-diff');

const stripPath = path.resolve('.');
const cli = new CLIEngine({
  useEslintrc: true
});

octokit.authenticate({
  type: 'token',
  token: process.env.GH_TOKEN
})

const [owner, repo, number] = ['kellym', 'lint-my-pr', 1];

const report = cli.executeOnFiles(['.']);
const errors = {};

report.results.forEach( err => {
  const file = err.filePath.replace(stripPath + '/', '');
  errors[file] = errors[file] || [];
  err.messages.forEach(m => {
    errors[file].push({ line: m.line, message: m.message });
  });
});

const result = octokit.pulls.get({ owner, repo, number, headers: {
  accept: 'application/vnd.github.v3.diff'
} }).catch(e => {
  console.log("couldn't authenticate", e);
});


const comments = {};

result.then(({ data }) => {
  data = parse(data);
  data.forEach( file => {
    if (errors[file.to]) {
      const fileErrors = {};
      errors[file.to].forEach(({ line, message }) => {
        let position = 1;
        file.chunks.forEach(chunk => {
          if (line >= chunk.newStart && line <= (chunk.newStart + chunk.newLines)) {
            const errorPosition = position + (line - chunk.newStart);
            fileErrors[errorPosition] = fileErrors[errorPosition] || [];
            fileErrors[errorPosition].push(message);
          }
          position += chunk.newLines;
        });
      });
      comments[file.to] = fileErrors;
    }
  });
  console.log(comments);

  const apiCalls = []
  octokit.pulls.get({ owner, repo, number }).then(({ data }) => {
    octokit.pulls.listComments({ owner, repo, number }).then(response => {
      const listCommentsData = response.data;

      const commit_id = data.head.sha;
      Object.keys(comments).forEach(path => {
        Object.keys(comments[path]).forEach(position => {
          const existingComment = listCommentsData.find(c => c.path == path && c.position == position);
          if (!existingComment) {
            apiCalls.push({ owner, repo, number, body: comments[path][position].join(' '), commit_id, path, position });
          }
        });
      });

      function create() {
        if (apiCalls.length) {
          const comment = apiCalls.pop();
          console.log('creating comment', comment);
          octokit.pulls.createComment(comment).then(() => {
            setTimeout(create, 1000);
          }).catch(e => {
            console.log('error', e);
          })
        }
      }
      create();


    });

  });

  });

