#!/usr/bin/env bash
# VERJI FILE
echo "Linking module-api"
git clone --depth 1 --branch $MODULE_API_BRANCH "$MODULE_API_REPO" module-api
cd module-api
yarn link
yarn --network-timeout=100000 install
yarn build
cd ../

echo "Setting up element-web with module-api packages"
yarn link '@matrix-org/react-sdk-module-api'

