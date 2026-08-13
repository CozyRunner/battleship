# Contributing to Battleship

Thank you for your interest in contributing to Battleship! This document provides guidelines and instructions for contributing.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## 📜 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it to understand what behavior is expected.

---

## 🤔 How Can I Contribute?

### Reporting Bugs

- Check [existing issues](https://github.com/yourusername/battleship/issues) to avoid duplicates
- Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md)
- Include detailed steps to reproduce
- Attach screenshots if applicable

### Suggesting Enhancements

- Check [existing issues](https://github.com/yourusername/battleship/issues) for similar suggestions
- Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md)
- Explain the use case and expected behavior

### Code Contributions

- Fix bugs
- Implement new features
- Improve documentation
- Write tests
- Optimize performance

---

## 💻 Development Process

### Prerequisites

- Node.js 18+
- npm or pnpm
- Git

### Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/battleship.git
   cd battleship
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/CozyRunner/battleship.git
   ```

4. **Install dependencies**
   ```bash
   corepack enable
   pnpm install
   ```

5. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Making Changes

1. **Follow coding standards** (see below)
2. **Write tests** for new functionality
3. **Update documentation** if needed
4. **Test your changes**
   ```bash
   pnpm test
   pnpm lint
   pnpm check
   ```

### Keeping Up to Date

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

---

## 📏 Coding Standards

Please read our [Coding Standards](docs/development/coding-standards.md) for detailed guidelines.

### Quick Summary

- **TypeScript** — Use TypeScript for all code
- **Formatting** — Use Prettier (config included)
- **Linting** — Use ESLint (config included)
- **Components** — Follow Svelte best practices
- **Testing** — Write tests with Vitest
- **Documentation** — Comment complex logic

### Code Style

```typescript
// Use meaningful variable names
const shipCoordinates: Coordinate[] = [];

// Use explicit types for function signatures
function placeShip(board: Board, ship: Ship, position: Coordinate): Board {
  // implementation
}

// Use async/await over Promise chains
async function fetchGameState(): Promise<GameState> {
  // implementation
}
```

---

## 📝 Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style (formatting, etc.) |
| `refactor` | Code refactoring |
| `test` | Adding or updating tests |
| `chore` | Build process or auxiliary tool changes |

### Examples

```bash
feat(game): add expert AI difficulty level

fix(socket): handle reconnection properly

docs(readme): update installation instructions

test(engine): add attack validation tests
```

---

## 🔀 Pull Request Process

### Before Submitting

- [ ] Tests pass (`pnpm test`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Type check passes (`pnpm check`)
- [ ] Documentation updated (if needed)
- [ ] Commits follow conventional commits

### Submitting

1. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request** on GitHub

3. **Fill out the PR template** with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots (if UI changes)
   - Testing instructions

4. **Wait for review** — Maintainers will review and provide feedback

5. **Address feedback** — Make requested changes and push updates

### PR Title Format

```
<type>(<scope>): <description>
```

Example: `feat(multiplayer): add room reconnection support`

---

## 🐛 Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- **Environment** — OS, browser, device
- **Steps to reproduce** — Clear, numbered steps
- **Expected behavior** — What should happen
- **Actual behavior** — What actually happens
- **Screenshots** — If applicable
- **Additional context** — Logs, error messages

---

## 💡 Requesting Features

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) and include:

- **Problem description** — What problem does this solve?
- **Proposed solution** — How should it work?
- **Alternatives considered** — Other approaches thought about
- **Additional context** — Mockups, examples

---

## ❓ Questions?

- Check [documentation](docs/)
- Open a [discussion](https://github.com/yourusername/battleship/discussions)
- Review [existing issues](https://github.com/yourusername/battleship/issues)

---

## 🎉 Thank You!

Your contributions help make Battleship better for everyone. We appreciate your time and effort!
