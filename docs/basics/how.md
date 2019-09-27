# How does it work?

`mhy` has a huge list of common/popular packages as it's dependencies
\(over **300 MB** when installed\). Usually in case you have several
projects on your computer, you end up having the same package
in your project's `node_modules` folder over and over again.
To eliminate this issue `mhy` uses it's own dependencies with-in
your project by providing you tools out-of-the-box which are
supporting this method.

1. Create an `src` folder in your project root.
2. Create an `index.js` inside.
3. Run the command: `mhy`
4. Voila, you have `webpack-dev-server` \(and other tools\) running

   without any `npm install` or dependency in your `package.json`

