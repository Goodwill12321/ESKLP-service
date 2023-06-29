const express = require('express')

const app = express()
const port = process.env.PORT || 3000

const MongoClient = require("mongodb").MongoClient;
const client = new MongoClient("mongodb://127.0.0.1:27017");


app.get('/mnn_by_name_exact/:name', function(req, res) {
    const name = req.params.name;
    client.connect().then( mongoClient=>{
        console.log("Подключение установлено");
        //console.log(mongoClient.options.dbName); // получаем имя базы данных
        
        const db = client.db("esklp");
        const collection = db.collection("mnn");
        const cursor = collection.find({'key_name.name': name});
        let docs = [];
        const allDocument = cursor.toArray().then(arr => {
            arr.forEach(doc => {
                console.log(doc);
                docs.push(doc);
                    });
            res.send(docs);
            });
        });
});   
          
app.get('/mnn_by_name_like/:pattern', function(req, res) {
 
    const pattern = req.params.pattern;
    client.connect().then( mongoClient=>{
        console.log("Подключение установлено");
        //console.log(mongoClient.options.dbName); // получаем имя базы данных
        
        const db = client.db("esklp");
        const collection = db.collection("mnn");

        let docs = [];
 
        //try {
            const cursor = collection.find(
                { 'key_name.name': { $regex: pattern, $options : "i"} });

        /*} catch (error) {
            console.log("Error while find by expr " + pattern + " : " + error.message)
            res.send(docs); 
            return;   
        }
        if (typeof cursor !== "undefined") {*/
            const allDocument = cursor.toArray().then(arr => {
                arr.forEach(doc => {
                    console.log(doc);
                    docs.push(doc);
                        });
                res.send(docs);
                });
        /*} else 
            res.send(docs);*/  
           
        });
    
});   
    

/*const bodyParser = require('body-parser');
// после инициализации const app
 app.use(bodyParser.urlencoded({ extended: true}));
 app.use(bodyParser.json());
// в методах:

 app.post('/posts', function(req, res) {
    // получаем данные из тела запроса и сохраняем в конст.
    const data = req.body;
    // посмотрим что у нас там? 
    console.log(data);
    // добавляем полученные данные к постам
    posts.push(data);
    // чтобы не было бесконечного цикла - вернем все посты на страницу
    return res.send(posts);
});*/

app.listen(port,()=>{
	console.log(`Server run on ${port} port`)
})

