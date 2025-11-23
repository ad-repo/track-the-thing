# Verification Rules

## Core Principle
**Verify your work before declaring it complete. Catch issues early.**

## Critical: CI Compliance

### Before Every Commit
1. Run the local CI test script unless the user says not to
2. Verify exit code is 0 (all checks pass)
3. Only commit if all checks pass or the user tells me to

### When CI Fails
- **DO NOT GUESS** - Look at actual CI error logs
- Reproduce error locally using exact CI commands
- Fix the error properly
- Re-run the test script to verify
- Only push if local checks pass

### Enforcement
- User overridde always takes presedence 
- Never push code without verifying it passes all checks locally
- Never run different commands than what CI runs
- Multiple CI failures due to not testing locally is unacceptable
- Treat violations as critical failures

## Pre-Commit Verification Checklist

### 1. Code Quality
- [ ] No linter errors introduced
- [ ] No console.log statements (except critical errors)
- [ ] No commented-out code left behind
- [ ] No unused imports
- [ ] No debug code or temporary hacks
- [ ] Follows existing code style
- [ ] TypeScript strict mode satisfied (if applicable)

### 2. Functionality
- [ ] Original request fulfilled completely
- [ ] Feature works as expected
- [ ] Edge cases considered
- [ ] Error handling appropriate
- [ ] No regressions introduced

### 3. Tests (CRITICAL)
- [ ] Existing tests still pass
- [ ] New tests added for new functionality
- [ ] Tests are meaningful (not stubs)
- [ ] Test names match their behavior
- [ ] No tests skipped or disabled without reason
- [ ] All tests contained in the top-level tests folder

#### Test Quality Standards
- [ ] Tests clearly express intent (no vague or placeholder assertions)
- [ ] Tests verify specific behavior, not just execution success
- [ ] Test data, mocks, and fixtures are realistic and relevant
- [ ] Test names communicate purpose and scope
- [ ] Both positive and negative test cases included
- [ ] No stub or placeholder tests that provide no verification

#### Test Rules
- **Never modify or simplify valid tests to make them pass**
- **Never change program code to fix tests** - fix the tests or understand why they fail
- Never rename or rewrite test titles to match incorrect behavior
- Never skip or delete tests without explicit approval
- Test functionality must match its title and intent
- All tests must pass before pushing or merging

#### Test Creation Requirements
- Create tests for all new features, routes, or components
- Create tests when modifying existing logic or algorithms
- Create tests when refactoring code that affects behavior
- Create tests when fixing bugs
- Create tests when changing database schema or data models
- Missing tests for new functionality are blockers for merge

#### Test Execution
- Run tests via the designated test script (containerized)
- Never run tests directly that could interfere with local environment
- Run all tests for the current section when major changes are made
- Run the full suite before pushing any code

### 4. Documentation (CRITICAL)
- [ ] README updated if user-facing changes
- [ ] API docs updated if endpoints changed
- [ ] Code comments added for complex logic
- [ ] Inline docs updated if function signatures changed
- [ ] Examples updated if behavior changed
- [ ] Documentation reflects actual runtime behavior
- [ ] Test changes trigger documentation review

#### Documentation Requirements
Update documentation when:
- Adding or modifying features
- Fixing or refactoring code that changes behavior
- Adjusting tests that expose behavior mismatches
- Updating configuration, interfaces, or data models

#### What to Update
- Markdown files and READMEs when code behavior changes
- External or internal docs when tests reveal undocumented functionality
- Migration and usage guides to match actual runtime behavior
- Inline code comments if a test fix clarifies unclear logic
- Deprecated behavior markings identified during testing

#### Documentation Verification
- After any test change, confirm documentation still accurately describes system behavior
- Cross-check test expectations and documented behavior for alignment
- Ensure test examples in docs (if any) run and pass
- Treat missing or outdated docs after test updates as blockers for merge

#### External Documentation Discovery
Before implementing or modifying functionality:
- Locate and review authoritative documentation
- Never assume undocumented behavior is correct
- Confirm with official spec or source documentation
- Search known documentation locations
- If documentation cannot be found, flag it as a gap and request clarification
- Reference discovered documentation explicitly when making changes
- Verify code and tests align with documented schemas and outputs

### 5. Database Changes
- [ ] Migration scripts created and in backend/migrations/
- [ ] Migrations tested (can upgrade from previous version)
- [ ] Backup/restore scripts updated in backend/app/routers/backup.py
- [ ] Schema changes are backward compatible OR documented as breaking

### 6. Configuration
- [ ] .env.example updated if new variables added
- [ ] Config docs updated
- [ ] Default values are sensible
- [ ] No secrets or credentials in code

### 7. Dependencies
- [ ] No unnecessary dependencies added
- [ ] Package versions specified
- [ ] requirements.txt or package.json updated
- [ ] Dependencies are compatible

### 8. Git Hygiene
- [ ] Only relevant files changed
- [ ] No unintended changes (check git diff)
- [ ] Commits are logical and focused
- [ ] Commit messages follow conventions
- [ ] No merge conflicts
- [ ] Branch is up to date with main

## Before Pushing

### Required Steps
```bash
# 1. Run linter for the section you modified

# 2. Run the containerized test script

# 3. Review changes
git status
git diff

# 4. Check for issues
# - Linter errors: 0
# - Test failures: 0
# - Unintended changes: 0
```

### Critical Checks (via local CI script)
- [ ] All linters pass
- [ ] All tests pass
- [ ] No type errors
- [ ] No security issues flagged

### Final Verification Checklist
- [ ] Fix all linter errors
- [ ] Add database migrations if schema changed
- [ ] Update backup/restore scripts if data model changed
- [ ] Update documentation and README as needed
- [ ] Verify existing docs are accurate
- [ ] Remove hardcoded credentials or API keys
- [ ] Follow established patterns and styles
- [ ] Verify all tests pass locally
- [ ] Remove unused or outdated files

## Verification Strategies

### For New Features
1. **Manual Testing**
   - Test happy path
   - Test error cases
   - Test edge cases
   - Test in different browsers/environments if UI

2. **Automated Testing**
   - Unit tests for logic
   - Integration tests for workflows
   - E2E tests for critical paths

3. **Documentation Check**
   - User docs explain how to use it
   - Developer docs explain how it works
   - API docs show request/response

### For Bug Fixes
1. **Reproduce the Bug**
   - Confirm you can reproduce it
   - Understand the root cause
   - Document what was broken
   - Check if external documentation describes expected behavior

2. **Verify the Fix**
   - Bug no longer occurs
   - No new bugs introduced
   - Related functionality still works
   - Fix aligns with documented behavior

3. **Prevent Recurrence**
   - Add test that would catch this bug
   - Document why it happened
   - Consider if similar bugs exist elsewhere
   - Update documentation if behavior was misunderstood

### For Refactoring
1. **Before Refactoring**
   - All tests pass
   - Document current behavior
   - Commit working state

2. **After Refactoring**
   - All tests still pass
   - Behavior unchanged
   - Code is clearer/better
   - No functionality lost

3. **Verification**
   - Side-by-side comparison
   - Performance not degraded
   - No subtle behavior changes

## Common Issues to Check

### Code Smells
- ❌ Duplicated code
- ❌ Long functions (>50 lines)
- ❌ Deep nesting (>3 levels)
- ❌ Magic numbers or strings
- ❌ God objects or functions
- ❌ Unclear variable names

### Integration Issues
- ❌ Hardcoded URLs or paths
- ❌ Assuming file/directory exists
- ❌ Not handling async properly
- ❌ Race conditions
- ❌ Memory leaks (event listeners not cleaned up)
- ❌ Missing error boundaries

### Security Issues
- ❌ SQL injection vulnerabilities
- ❌ XSS vulnerabilities
- ❌ Exposed credentials
- ❌ Unvalidated user input
- ❌ Missing authentication checks
- ❌ Insecure defaults

## Self-Review Process

### Before Declaring Done
1. **Read your changes**
   - Does it make sense?
   - Is it clear?
   - Would you approve this PR?

2. **Test manually**
   - Actually use the feature
   - Try to break it
   - Test as a user would

3. **Check side effects**
   - What else might this affect?
   - Are there other callers?
   - Did you update all references?

4. **Review checklist**
   - Go through pre-commit checklist above
   - All items checked
   - No items skipped

## When in Doubt

### Ask Yourself
- Would I trust this code in production?
- Have I tested all the important cases?
- Is the documentation accurate?
- Would another developer understand this?
- Did I follow the project conventions?

### Better Safe Than Sorry
- ✅ Run tests again
- ✅ Double-check documentation
- ✅ Review changes one more time
- ✅ Ask for clarification
- ❌ "It's probably fine"
- ❌ "I'll fix it later"
- ❌ "Tests are optional for small changes"

## Cleanup Verification

### When to Run Cleanup
- Before every push or major merge
- After large refactors, feature removals, or migration changes

### Code Cleanup
- [ ] Remove unused imports, functions, and variables
- [ ] Delete dead or unreachable code
- [ ] Remove deprecated feature flags or conditionals
- [ ] Verify removed code is not referenced in tests, docs, or configs

### File Cleanup
- [ ] Delete obsolete scripts and utilities
- [ ] Remove temporary or local-use-only files (debug helpers, scratch code)
- [ ] Delete outdated documentation for removed features
- [ ] Keep only one canonical version of each doc or guide
- [ ] Remove duplicate or outdated migration and backup scripts

### Cleanup Verification
- [ ] Search for unused files or modules
- [ ] Confirm deletions are tracked by version control
- [ ] Ensure no production dependencies rely on deleted files
- [ ] Verify build and test pipelines pass after cleanup
- [ ] If uncertain about a file, mark it deprecated instead of deleting

## Quick Reference

### Minimal Viable Verification
1. Linter passes
2. Tests pass (via containerized script)
3. Manual testing done
4. Documentation updated
5. No unintended changes
6. CI script passes locally

### Full Verification
Above +
7. Security review
8. Performance check
9. Cross-browser/platform testing
10. Migration testing
11. Rollback plan exists
12. External documentation verified

