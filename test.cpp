int v = 5;
int i = v;
char c = 300;
char* s;
float f = 3.1;
float g = 2.2;
printf(f + g)
5.300000000001

i = f();

s = new char[30];
char* sd2 = new(100);
strcpy(sd2, 'tra la la');

s[1] = 'a';

int a = 5
int* s2 = &a;

s = sd2;
s = 'papa';
strcpy(s, 'papa');

delete[] s;

int a = 300;

int f(char c, int b)
{
   short sh = 5;
   sh = c;
   sh++;
   int x = sh + b + 100;
   return x;
}



struct Company
{
    int persCount;
    char* Name;
    char s[100];
}

Company CocaCola;
CocaCola.Name = new char[100];
strcpy(CocaCola.Name, 'Coca Cola');
strcpy(CocaCola.s, 'The best company in the world');
CocaCola.persCount = 1000;

int s  = (int)c;

fC((Company*)&a);

bool fC(Company* c)
{
    (*c).s[3]
    
    c->s[10] = 'q';
    c->persCount = b;
}