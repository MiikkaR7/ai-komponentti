const path = require("node:path");
const webpack = require("webpack")
require('dotenv').config()

module.exports = {
    entry: "./src/index.js",
    output: { path: path.resolve(__dirname, "dist") },
    plugins: [
        new webpack.EnvironmentPlugin(['SUPABASE_URL', 'SUPABASE_ANON_KEY'])
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
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            }
        ]
    }
};
