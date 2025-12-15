# Contributing

To start developing this module:

```
nvm use
npm i
```

After making changes, build the module:

```
npm run build
```

Test your changes fully.

## Local integration testing

To link your local node-utils package into the `node_modules` folder of a local app that uses it:

```
npm link
cd ../integrating-app
npm link @nypl/node-utils
```

The `integrating-app` application will now symlink the local node-utils module into its `node_modules` folder, enabling you to use the locally served package.

Note:
 - If you make changes to your local `node-utils` folder, you'll need to run `npm run build` in that folder
 - If you run `npm install` in your `integrating-app` folder, the link will be severed, requiring you to run `npm link @nypl/node-utils` again

## Publishing

Ensure properly tagged:

- Bump the version number in `package.json`
- Run `nvm use; npm i` to update package-lock.json
- Commit changes
- Git tag it (e.g. `git tag -a v1.0.0`)
- Push changes to origin (including tags via `git push --tags`)

Publish changes to NPMJS:

- `npm config set access public` (Should only be necessary to run this once.)
- Run npm `publish --dry-run` to verify nothing is being packaged that should not be!
- Run `npm publish`
