const path = require("path");
const webpack = require("webpack")
require('dotenv').config()

const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')

module.exports = {
    entry: "./src/index.js",
    output: { path: path.resolve(__dirname, "dist") },
    plugins: [
        new NodePolyfillPlugin(),
        new webpack.DefinePlugin({
            'process.env': {
                SUPABASE_URL: JSON.stringify(process.env.SUPABASE_URL),
                SUPABASE_ANON_KEY: JSON.stringify(process.env.SUPABASE_ANON_KEY)
            }
        })
    ],
    module: {
        rules: [
                    {
                        test: /\.(js|jsx)$/,
                        exclude: /node_modules/,
                        use: {
                            loader: "babel-loader",
                            options: {
                                presets: [
                                        "@babel/preset-env",
                                        ["@babel/preset-react", {"runtime": "automatic"}]
                                ]
                            }
                        }
                    }
                ],
        }
};