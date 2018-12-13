#!/usr/bin/env node

const { argv } = require('yargs'),
      Linter   = require('../lib/linter.js');

const { slug, pr, dry, token, config } = argv,
      [owner, repo] = slug.split('/');

const linter = new Linter({
  owner,
  repo,
  pr,
  dry,
  token,
  config
});

linter.run().then(() => {
  console.log(`${ linter.errorCount } error(s), ${ linter.createdCommentCount } comment(s) created`);
});

