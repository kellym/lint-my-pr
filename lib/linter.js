const path          = require('path'),
      async         = require('async'),
      parse         = require('parse-diff'),
      { CLIEngine } = require('eslint'),
      octokit       = require('@octokit/rest')(),
      debug         = require('debug')('lint-my-pr');

class Linter {

  constructor({ owner, repo, dry, pr, token = process.env.GITHUB_TOKEN, config, basePath = '.', path = '.' }) {
    Object.assign(this, { owner, repo, dry, pr, token, config, path, basePath });
    this.errorCount = 0;
    this.errorCountForPR = 0;
    this.createdCommentCount = 0;
  }

  setup() {
    this.cli = new CLIEngine({
      configFile: this.config,
      useEslintrc: !this.config
    });
    octokit.authenticate({
      type: 'token',
      token: this.token
    });
  }

  run() {
    return new Promise(async resolve => {
      this.setup();
      this.lint();
      if (!this.errorCount) return resolve();
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
    this.stripPath = path.resolve(this.basePath);
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
    const response = await octokit.pulls.get(this.props({
      headers: {
        accept: 'application/vnd.github.v3.diff'
      }
    }));
    this.diff = parse(response.data);
  }

  async getLatestCommit() {
    const response = await octokit.pulls.get(this.props());
    this.pullRequest = response.data;
    this.latestCommit = this.pullRequest.head.sha;
  }

  async getCommentsOnPR() {
    const response = await octokit.pulls.listComments(this.props());
    this.commentsOnPR = response.data;
  }

  compileComments() {
    this.fileComments = {};
    this.errorCountForPR = 0;
    this.diff.forEach(file => {
      if (this.errors[file.to]) {
        const fileErrors = {};
        this.errors[file.to].forEach(({ line, message }) => {
          let position = 0;
          file.chunks.forEach(chunk => {
            // one line down for each new check header
            position++;
            // if this chunk houses the line with the error, track it
            if (line >= chunk.newStart && line <= (chunk.newStart + chunk.newLines)) {
              // now we have to find the actual position based on add/del.
              let errorPosition = position + (line - chunk.newStart);
              let i;
              for (i = 0; i < chunk.changes.length; i++) {
                const change = chunk.changes[i];
                if (!change.del && (change.ln2 || change.ln) >= line) break;
                if (change.del) errorPosition++;
              }
              const markedChange = chunk.changes[i];
              if (!markedChange || !markedChange.normal) {
                fileErrors[errorPosition] = fileErrors[errorPosition] || [];
                fileErrors[errorPosition].push(message);
                this.errorCountForPR++;
                debug(chunk);
                debug(`[${file.to}:${errorPosition}] ${message} (L${line})`);
              }
            } else {
              chunk.changes.forEach(change => {
                if (change.del) position++;
              });
            }
            position += chunk.newLines;
          });
        });
        this.fileComments[file.to] = fileErrors;
      }
    });
  }

  createNewComments() {
    return new Promise(resolve => {
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
            this.newComments.push({ body, path, position });
          }
        });
      });

      // now actually go through and create comments at a rate of 1 per second
      this.iterateThroughComments(resolve);

    });

  }

  iterateThroughComments(done) {
    async.eachSeries(this.newComments, (comment, next) => {
      debug(`Creating comment: ${JSON.stringify(comment)}`);
      if (this.dry) return next();
      octokit.pulls.createComment(this.props(comment, { commit_id: this.latestCommit })).then(() => {
        this.createdCommentCount++;
        setTimeout(() => next(), 100);
      }).catch(e => {
        const errorMessage = `Error creating comment: ${JSON.stringify(e)}`;
        debug(errorMessage);
        next(new Error(errorMessage));
      });
    }, done);
  }

  props(...extra) {
    return Object.assign({
      owner: this.owner,
      repo: this.repo,
      number: this.pr
    }, ...extra);
  }

}

module.exports = Linter;

