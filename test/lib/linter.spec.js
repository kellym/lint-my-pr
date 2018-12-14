const test  = require('tape'),
      parse = require('parse-diff'),
      path  = require('path'),
      fs    = require('fs');

const Linter = require('../../lib/linter');

const config = './test/fixtures/eslintrc';

test('Linter', t => {

  let linter;
  function setup() {
    linter = new Linter({ config });
  }

  test('compileComments', t => {

    test('correctly assigns positions in diff for add', t => {
      const addDiff = fs.readFileSync(path.resolve('./test/fixtures/add.diff'));
      linter.diff = parse(addDiff);
      linter.path = './test/fixtures/add.js';
      linter.setup();
      linter.lint();

      linter.compileComments();

      t.end();

    });

    t.end();

  });

  t.end();

});

