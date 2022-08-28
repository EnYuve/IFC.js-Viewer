import resolve from  "@rollup/plugin-node-resolve"

export default{
    input: './index.js', //archivo de origen
    output: [
        {
            format: 'esm',
            file: './bundle.js',  //archivo que genera
        }
    ],
    plugins: [
        resolve()
    ]
}