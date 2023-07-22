const express = require('express')

const app = express()
const port = process.env.PORT || 3000

const MongoClient = require("mongodb").MongoClient;
const client = new MongoClient("mongodb://127.0.0.1:27017");


app.get('/mnn_by_name_exact/:name', function(req, res) {
    const name = req.params.name;
    client.connect().then( mongoClient=>{
        console.log("Подключение установлено");
        
        const db = client.db("esklp");
        //коллекция МНН
        const col_MNN = db.collection("mnn");
        //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
        const col_KLP = db.collection("klp");
        //ищем МНН по имени
        const cursor = col_MNN.find({'attr_NAME': name});

        //массив возвращаемых документов
        let docs = [];
        //асинхронный вызов получения массива документов
        const allDocuments = cursor.toArray();

        //массив промисов для ожидания получения подчиненных КЛП
        let promises = [];
        //соответствие СМНН - узла массива СМНН по его UUID, чтобы обработать в конечном then после обработки массивов КЛП и добавить подчиненный элемент
        let promises_smnn = {};
                          
        allDocuments.then(arr => {
            arr.forEach(doc => {
                console.log(doc);
                if (doc.SMNN_LIST.children.length > 0)
                {
                    pr = doc.SMNN_LIST.children.forEach(function(smnn)
                    {   
                        smnn.KLP_LIST_JOINED = [];
                        //ищем в подчиненной коллекции элементы по внешнему ключу, который хранится в первичном ключе СМНН attr_UUID
                        const cursorKLP = col_KLP.find({'parent_SMNN_UUID': smnn.attr_UUID});  
                        //сохраняем пропмис в массив чтобы потом дождаться их всех перед отправкой
                        promises.push(cursorKLP.toArray());    
                        //сохраняем в словарь соответствие СНММ его УУИД чтобы не перебирать потом всю структуру для его поиска после Promise.all
                        promises_smnn[smnn.attr_UUID] = smnn;
                    });
                };
                //добавляем в коллекцию документ МНН, но он еще не обогащен подчиненными элементами - это будет асинхронно потом после Promise.all 
                docs.push(doc);
            });
            
            //ждем все обработки всех массивов. promises - это массив промисов, каждый из которых возвращает массив КЛП. 
            // Т.е. результатом ожидания будет массив массивов arraysKLP
            Promise.all(promises).then(arraysKLP => {
                for (arrKLP of arraysKLP)
                {
                    for(klp of arrKLP)
                    {
                        promises_smnn[klp.parent_SMNN_UUID].KLP_LIST_JOINED.push(klp);
                    }
                }
                }).then(r =>
                    {   //после того, как все заполнено, возвращаем обогащенные МНН
                        res.send(docs);
                    }
                );
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

