// // /** Coded by - MODERAX **/
#include<iostream>
#include<string>
#include<vector>
#include<algorithm>
#include<sstream>
#include<cmath>
#include<random>
#include<chrono>
#include<map>
#include<climits>
#include<unordered_set>
#include<queue>
#include<unordered_map>
#include<functional>
#include<bitset>
#include<set>
#include<list>
#include<iterator>
#include<utility>
#include<array>
#include<tuple>
#include<complex>
#include<limits>
#include<fstream>
#include<ctime>
#include<cstring>
#include<cstdio>
#include<cstdlib> 
#include<cassert>
#include<stack>
#include<numeric>
#include<initializer_list>
#include<type_traits>
#include<regex>
#include<valarray>
#include <numeric>

using namespace std;

#define int long long
#define pb push_back
#define all(v) v.begin(), v.end()
#define vi vector<long long>
#define vvi vector<vector<long long> >
#define vvc vector<vector<char> >
#define vvb vector<vector<bool> >
#define vs vector<string>
#define vb vector<bool>
#define vp vector<pair<int,int> >
#define f(i,a,b) for(int i=a;i<b;i++)
#define of(i,a,b) for(int i=a;i>=b;i--)
#define YES cout<<"Yes"<<endl
#define NO cout<<"No"<<endl
#define endl '\n'

mt19937_64 RNG(chrono::steady_clock::now().time_since_epoch().count());
int randInt(int l,int r){return uniform_int_distribution<int>(l,r)(RNG);} 

const int mod=998244353;
const int MOD=1e9+7;
const int INF=1e6;
vi primes;
void precom(){

}

int bakchodi(int curr){
   int ans=0;
   while(curr>0){
    int dig=curr%10;
    ans+=(dig*dig);
    curr/=10;
   }
   return ans;
}
int gcd(int a, int b) {
    while(b) {
        a %= b;
        swap(a, b);
    }
    return a;
}

void  SOLVE_BLOCK(){
    int n; cin>>n;
    vi arr(n);
    f(i,0,n) cin>>arr[i];
    //
    sort(all(arr));
    cout<<arr[(n-1)/2]<<endl;
    
}

signed main(){
    auto begin = chrono::high_resolution_clock::now();
    ios_base::sync_with_stdio(false);
    cin.tie(NULL); 
    cout.tie(NULL);

    int __ =1;
    cin >> __;
    precom();
    f(i,1,__+1) {
       // cout<<"#Case no : "<<i;
        SOLVE_BLOCK();
    }
}
