# How to publish a new verison of our package.

```sh
npm config set git-tag-version=false
npm version major|minor|patch
git commit -m 'bump to new version'
git push origin HEAD
```

Then go to Github `Releases`.
Create a new release using a tag with the version `vx.y.z` that you
just created in the package json.
Add a release title and a description.

Here is some more information on creating releases:
https://docs.github.com/en/github/administering-a-repository/releasing-projects-on-github/managing-releases-in-a-repository

Then to `Actions` and find the Github Action that does the automatic publishing
of the package to npm. It will be triggered automatically by the newly
created release.
