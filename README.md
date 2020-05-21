# 🏗 Baseplate

## Prerequisites

- [Node.js](https://nodejs.org/en/download/) and npm
- A PostgreSQL 9.4+ database

## Installation

1. Install development dependencies

   ```sh
   npm install
   ```

1. Install dependencies of each package

   ```sh
   lerna bootstrap
   ```

1. Run the following SQL query in the `psql` console to ensure your database has the `uuid-ossp` extension installed

   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

## Contributing

This project uses the [ESLint](https://eslint.org/) linter and the [Prettier](https://prettier.io/) code formatter.

To ensure your code conforms to the rules, run `npm run format`.
