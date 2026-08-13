# Dependency Management

This project uses **pnpm** and **Turborepo** to manage dependencies and workspace orchestration.

## 📦 Package Manager: pnpm

`pnpm` is the chosen package manager for its speed, space efficiency, and robust support for monorepo workspaces.

### Corepack

The project is configured to use **Corepack** to ensure the correct `pnpm` version is used across all development environments.

```bash
corepack enable
```

### Common Commands

- **Install Dependencies:** `pnpm install`
- **Add a Package to a specific app:** `pnpm add <package> -F <app-name>`
  - Example: `pnpm add socket.io -F @battleship/web`
- **Add a Dev Dependency:** `pnpm add -D <package> -F <app-name>`
- **Update Packages:** `pnpm update`

## 🏎️ Orchestration: Turborepo

**Turborepo** manages the build pipeline and caches task outputs to speed up development.

### Pipeline Configuration

The pipeline is defined in `turbo.json` and includes tasks for:

- `build`: Compiles all applications.
- `dev`: Runs development servers in parallel.
- `test`: Executes test suites.
- `lint`: Checks code style.
- `check`: Runs Svelte type checking.

### Execution

Turborepo commands are proxied through the root `package.json` scripts:

```bash
pnpm dev   # Runs turbo run dev
pnpm build # Runs turbo run build
```

## 📂 Workspace Structure

- `apps/web`: `@battleship/web` (SvelteKit + Socket.IO Function)

Dependencies are shared via the `pnpm` workspace, but each application maintains its own `package.json` for specific needs.

## 🔄 Version Management

We use **Semantic Versioning (SemVer)** for all internal and external dependencies. The root `package.json` specifies the supported `packageManager` version to prevent environment drift.
