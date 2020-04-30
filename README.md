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

1. Create a user

   ```sh
   BASEPLATE_ACCESS_LEVEL=admin BASEPLATE_USERNAME=<your-username> BASEPLATE_PASSWORD=<your-password> node scripts/createUser.js
   ```

1. Obtain an access token for the user you've just created

   ```sh
   POST http://localhost:3000/_users/token

   {
      "grant_type": "password",
      "username": "<your-username>",
      "password": "<your-password>"
   }
   ```

1. Grab the access token in the `access_token` field from the response

1. Access sample model, passing the access token in the `Authorization` header

   ```
   GET http://localhost:3000/book

   Authorization: Bearer <your-access-token>
   ```

## Contributing

This project uses the [ESLint](https://eslint.org/) linter and the [Prettier](https://prettier.io/) code formatter.

To ensure your code conforms to the rules, run `npm run format`.
