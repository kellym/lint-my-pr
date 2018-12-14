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

    test('diff for add', t => {
      const file = 'test/fixtures/add';
      setup();
      const addDiff = fs.readFileSync(path.resolve(`./${file}.diff`), 'utf8');
      linter.diff = parse(addDiff);
      linter.path = `./${file}.js`;
      linter.setup();
      linter.lint();
      linter.compileComments();
      const comments = linter.fileComments[`${file}.js`];
      t.deepLooseEqual(comments, {
        1: ['\'daysOfSun\' is assigned a value but never used.'],
        2: [
          'A space is required after \',\'.',
          'A space is required after \',\'.'
        ],
        3: ['A space is required before \'}\'.', 'Missing semicolon.'],
        5: ['\'getFactAboutCountry\' is defined but never used.'],
        10: ['Missing semicolon.'],
        12: ['Strings must use singlequote.']
      }, 'correctly assigns positions');
      t.end();
    });

    test('diff for subtract', t => {
      const file = 'test/fixtures/subtract';
      setup();
      const addDiff = fs.readFileSync(path.resolve(`./${file}.diff`), 'utf8');
      linter.diff = parse(addDiff);
      linter.path = `./${file}.js`;
      linter.setup();
      linter.lint();
      linter.compileComments();
      const comments = linter.fileComments[`${file}.js`];
      t.looseEqual(comments, {}, 'ignores errors on subtracted lines');
      t.end();
    });

    test('diff for add and subtract', t => {
      const file = 'test/fixtures/add-and-subtract';
      setup();
      const addDiff = fs.readFileSync(path.resolve(`./${file}.diff`), 'utf8');
      linter.diff = parse(addDiff);
      linter.path = `./${file}.js`;
      linter.setup();
      linter.lint();
      linter.compileComments();
      const comments = linter.fileComments[`${file}.js`];
      t.deepLooseEqual(comments, {
        4: ['A space is required before \'}\'.'],
        5: [
          '\'weddingEvents\' is assigned a value but never used.',
          'A space is required after \',\'.',
          'There should be no space before \']\'.'
        ]
      }, 'correctly assigns positions after additions and subtractions');
      t.end();
    });

    test('diff for add and subtract multiple times', t => {
      const file = 'test/fixtures/multiple-add-and-subtract';
      setup();
      const addDiff = fs.readFileSync(path.resolve(`./${file}.diff`), 'utf8');
      linter.diff = parse(addDiff);
      linter.path = `./${file}.js`;
      linter.setup();
      linter.lint();
      linter.compileComments();
      const comments = linter.fileComments[`${file}.js`];
      t.deepLooseEqual(comments, {
        4: ['A space is required before \'}\'.'],
        5: [
          'A space is required after \',\'.',
          'There should be no space before \']\'.'
        ],
        16: ['Missing semicolon.']
      }, 'correctly assigns positions after multiple add and subtracts');
      t.end();
    });

    test('diff with multiple chunks', t => {
      const file = 'test/fixtures/multiple-chunks';
      setup();
      const addDiff = fs.readFileSync(path.resolve(`./${file}.diff`), 'utf8');
      linter.diff = parse(addDiff);
      linter.path = `./${file}.js`;
      linter.setup();
      linter.lint();
      linter.compileComments();
      const comments = linter.fileComments[`${file}.js`];
      t.deepLooseEqual(comments, {
        13: ['A space is required before \'}\'.'],
        14: [
          'A space is required after \',\'.',
          'There should be no space before \']\'.'
        ],
        28: ['Missing semicolon.']
      }, 'correctly assigns positions after multiple chunks');
      t.end();
    });

    t.end();

  });

  t.end();

});

