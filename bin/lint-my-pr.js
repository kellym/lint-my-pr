#!/usr/bin/env node

const { argv } = require('yargs'),
      Linter   = require('../lib/linter.js');

const { slug, pr, dry, token, config } = argv,
      [owner, repo] = slug.split('/');

process.on('unhandledRejection', error => {
  console.log('unhandledRejection', error);
  process.exit(1);
});

const linter = new Linter({
  owner,
  repo,
  pr,
  dry,
  token,
  config
});

linter.run().then(() => {
  console.log(`${ linter.errorCount } error(s), ${ linter.errorCountForPR } error(s) from this PR. ${ linter.createdCommentCount } comment(s) created`);
  if (linter.errorCountForPR) process.exit(1);
  else process.exit();
});

