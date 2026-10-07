const { tokenize } = require('./src/tokenizer');
const { parse } = require('./src/parser');
const { preprocess } = require('./src/preprocessor');

const code = `
#include<iostream>
using namespace std;
#define int long long
int bakchodi(int curr){
   int ans=0;
   while(curr>0){
    int dig=curr%10;
    ans+=(dig*dig);
    curr/=10;
   }
   return ans;
}
`;

try {
    const pp = preprocess(code);
    console.log("Preprocessed:", pp);
    const tokens = tokenize(pp);
    console.log("Tokens:", tokens.slice(0, 20).map(t => `${t.type}(${t.value})`));
    const ast = parse(tokens);
    console.log("Success");
} catch (e) {
    console.error(e);
}
