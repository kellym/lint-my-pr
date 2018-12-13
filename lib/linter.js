const _path          = require('path'),
      parse         = require('parse-diff'),
      { CLIEngine } = require('eslint'),
      octokit       = require('@octokit/rest')(),
      debug         = require('debug')('lint-my-pr');

class Linter {

  constructor({ owner, repo, dry, pr, token = process.env.GITHUB_TOKEN, config, path = '.' }) {
    Object.assign(this, { owner, repo, dry, pr, token, config, path });
    this.cli = new CLIEngine({
      configFile: config,
      useEslintrc: !config
    });
    this.stripPath = _path.resolve(this.path);

    octokit.authenticate({
      type: 'token',
      token: this.token
    });
  }

  run() {
    return new Promise(async resolve => {
      this.lint();
      if (!this.errorCount) return;
      await this.getDiff();
      await this.getLatestCommit();
      await this.getCommentsOnPR();
      this.compileComments();
      await this.createNewComments();
      resolve();
    });
  }

  lint() {
    this.errors = {};
    this.errorCount = 0;
    this.cli.executeOnFiles([this.path]).results.forEach(error => {
      //FIXME: use regex for string replacement
      const file = error.filePath.replace(`${this.stripPath}/`, '');
      this.errors[file] = this.errors[file] || [];
      error.messages.forEach(msg => {
        this.errors[file].push(msg);
        debug(`Error on line ${msg.line}: ${msg.message}`);
        this.errorCount++;
      });
    });
  }

  async getDiff() {
    const response = await octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      number: this.pr,
      headers: {
        accept: 'application/vnd.github.v3.diff'
      }
    });
    this.diff = parse(response.data);
  }

  async getLatestCommit() {
    const response = await octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      number: this.pr
    });
    this.pullRequest = response.data;
    this.latestCommit = this.pullRequest.head.sha;
  }

  async getCommentsOnPR() {
    const response = await octokit.pulls.listComments({
      owner: this.owner,
      repo: this.repo,
      number: this.pr
    })
    this.commentsOnPR = response.data;
  }

  compileComments() {
    this.fileComments = {}
    this.diff.forEach(file => {
      if (this.errors[file.to]) {
        const fileErrors = {};
        this.errors[file.to].forEach(({ line, message }) => {
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
        this.fileComments[file.to] = fileErrors;
      }
    });
  }

  createNewComments() {
    return new Promise((resolve, reject) => {
      this.createdCommentCount = 0;
      this.newComments = [];
      Object.keys(this.fileComments).forEach(path => {
        const file = this.fileComments[path];
        // then loop through each line number with errors
        Object.keys(file).forEach(position => {
          // if there's no existing comment with the same message, add it.
          const existingComment = this.commentsOnPR.find(c => c.path == path && c.position == position);
          const body = file[position].join(' ');
          if (!existingComment || existingComment.body != body) {
            this.newComments.push({ owner, repo, number, body, commit_id, path, position });
          }
        });
      });

      function create() {
        if (this.newComments.length) {
          const comment = this.newComments.pop();
          debug(`Creating comment: ${JSON.stringify(comment)}`);
          octokit.pulls.createComment(comment).then(() => {
            this.createdCommentCount++;
            setTimeout(create, 1000);
          }).catch(e => {
            debug(`Error creating comment: ${JSON.stringify(e)}`);
          });
        } else {
          resolve();
        }
      }
      // now actually go through and create comments at a rate of 1 per second
      if (!this.dry) create();
      else resolve();
    });

  }
}

module.exports = Linter;
