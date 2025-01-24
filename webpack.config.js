const path = require("node:path");
const webpack = require("webpack");
require('dotenv').config();
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: "./src/index.js",
    plugins: [
        new webpack.EnvironmentPlugin(['SUPABASE_URL', 'SUPABASE_ANON_KEY']),
        new HtmlWebpackPlugin({
            title: 'Static Site'
        }),
    ],
    output: { 
        filename: 'hankeai.bundle.js',
        path: path.resolve(__dirname, "dist") },
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
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            }
        ]
    }
};
