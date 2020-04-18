# 🏗 Baseplate

## Prerequisites

- A MongoDB database. [Install locally](https://docs.mongodb.com/manual/installation/) or spin up a free, hosted [mLab database](https://mlab.com/)
- [Node.js](https://nodejs.org/en/download/) and npm

## Usage

1. Install dependencies

   ```sh
   npm install
   ```

1. Edit database details in [`lib/datastore/index.js`](https://github.com/baseplatejs/core/blob/master/lib/datastore/index.js#L4-L5)

1. Run development server

   ```sh
   npm run dev
   ```

1. Access sample model

   ```
   GET http://localhost:3000/book
   ```

## Contributing

This project uses the [ESLint](https://eslint.org/) linter and the [Prettier](https://prettier.io/) code formatter.

To ensure your code conforms to the rules, run `npm run format`.
