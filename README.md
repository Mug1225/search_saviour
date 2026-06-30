# SearchSavior Monorepo

This repository contains the modular backend components and engines for the SearchSavior product. It is structured as an npm workspaces monorepo to allow future modules to be added seamlessly.

## Repository Structure

* `modules/`: Contains individual standalone backend modules.
  * `ai-max-recovery/`: The AI Max Recovery Audit module (diagnoses match hangovers, identifies leakage, recommends negatives).
* `package.json`: Configures root workspaces.

## Developing and Running Modules

Each module under `modules/` is independent. Please navigate to the specific module directory to run installation and tests.

For example, to run the AI Max Recovery Audit locally:
```bash
cd modules/ai-max-recovery
npm install
npm test
```
