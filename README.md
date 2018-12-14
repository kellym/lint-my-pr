# Lint My PR

This automates the process of linting pull requests and adds comments to the lines with problems.  There are other
linters available for Travis, but none of them create comments to mark problem lines, and others require way too much configuration.

Setup is simple.

```
npm install --save-dev lint-my-pr
```

[Create a new personal Github token](https://github.com/settings/tokens), then set up your Travis environment 
with that token set to `GITHUB_TOKEN`.  See Travis docs for help on that (you can add it either via the command line 
or via their website). 

Then add the script to your `.travis.yml` file. I'd suggest using the "stages" feature:

```yaml
- jobs
  include:
    - stage: linting
      if: type = pull_request
      script: lint-my-pr --slug="${TRAVIS_PULL_REQUEST_SLUG}" --pr="${TRAVIS_PULL_REQUEST}"
```

Using `if: type = pull_request` ensures that the linter only runs on PR commits.

There are other configuration options available. Here is the complete list.

| Argument | Description |
| -------- | ----------- |
| `--slug` | The slug (`:owner/:repo`) for the pull request
| `--pr` | The issue number of the PR
| `--dry` | Go through the process of linting, but don't create comments on the PR
| `--token` | Manually set a token instead of using the environment variable 
| `--config` | Specify the path to your `.eslintrc` config you want to use
| `--path` | The path you want to lint. This defaults to the root path of the repo
