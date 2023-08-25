const express = require('express')

const app = express()
const port = process.env.PORT || 3000

const MongoClient = require("mongodb").MongoClient;
const client = new MongoClient("mongodb://127.0.0.1:27017");


function get_SMNN(name, only_actual, exactly, withKLP, res)
{
    console.time('get_SMNN');
    client.connect().then(mongoClient => {
        console.log("Подключение установлено");

        const db = client.db("esklp_service");
        //коллекция МНН
        const col_MNN = db.collection("smnn");
        //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
        const col_KLP = db.collection("klp");
        //ищем МНН по имени
        let cursor = undefined;
       
        if (exactly)
            query_name = { 'mnn': name };
        else
            query_name = { 'mnn': { $regex: name, $options : "i"}};

        if (only_actual)
            query = {$and : [query_name, {"date_end" : { $exists:false}}]};
        else
            query = query_name;
        
        
        console.log('query = ' + JSON.stringify(query));    
        cursor = col_MNN.find(query).sort({'attr_name': 1});    
        
        //массив возвращаемых документов
        let docs = [];
        //асинхронный вызов получения массива документов
        const allDocuments = cursor.toArray();

        //массив промисов для ожидания получения подчиненных КЛП
        let promises = [];
        //соответствие СМНН - узла массива СМНН по его UUID, чтобы обработать в конечном then после обработки массивов КЛП и добавить подчиненный элемент
        let smnn_uuid = {};

        allDocuments.then(arr => {
            arr.forEach(doc => {
                console.log(doc);
                if (withKLP && doc.smnn_list.children.length > 0) {
                    pr = doc.smnn_list.children.forEach(function (smnn) {
                        smnn.KLP_LIST_JOINED = [];
                        //ищем в подчиненной коллекции элементы по внешнему ключу, который хранится в первичном ключе СМНН attr_UUID
                        const cursorKLP = col_KLP.find({ 'parent_SMNN_UUID': smnn.attr_UUID });
                        //сохраняем пропмис в массив чтобы потом дождаться их всех перед отправкой
                        promises.push(cursorKLP.toArray());
                        //сохраняем в словарь соответствие СНММ его УУИД чтобы не перебирать потом всю структуру для его поиска после Promise.all
                        smnn_uuid[smnn.attr_UUID] = smnn;
                    });
                };
                //добавляем в коллекцию документ МНН, но он еще не обогащен подчиненными элементами - это будет асинхронно потом после Promise.all 
                docs.push(doc);
            });

            //ждем все обработки всех массивов. promises - это массив промисов, каждый из которых возвращает массив КЛП. 
            // Т.е. результатом ожидания будет массив массивов arraysKLP
            Promise.all(promises).then(arraysKLP => {
                for (arrKLP of arraysKLP) {
                    for (klp of arrKLP) {
                        smnn_uuid[klp.parent_SMNN_UUID].KLP_LIST_JOINED.push(klp);
                    }
                }
            }).then(r => {   //после того, как все заполнено, возвращаем обогащенные МНН
                res.send(docs);
                console.timeEnd('get_SMNN');
            }
            );
        });
    });
    
}



function get_KLP_smmnn_uuid(smnn_uid, res)
{
    console.time('get_KLP_smmnn_uuid');
    client.connect().then(mongoClient => {
    console.log("Подключение установлено");

    const db = client.db("esklp_service");
    //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
    const col_KLP = db.collection("klp");
    //ищем МНН по имени
    const cursorKLP = col_KLP.find({ 'parent_SMNN_UUID': smnn_uid }).sort({'trade_name': 1, 'lf_norm_name' : 1});

    //массив возвращаемых документов
    let docs = [];
    //асинхронный вызов получения массива документов
    const allDocuments = cursorKLP.toArray();


    allDocuments.then(arr => {
        arr.forEach(doc => {
            //добавляем в коллекцию документ МНН, но он еще не обогащен подчиненными элементами - это будет асинхронно потом после Promise.all 
            docs.push(doc);
        });}).then(r => {   //после того, как все заполнено, возвращаем KLP
            res.send(docs);
            console.timeEnd('get_KLP_smmnn_uuid');
        });
    });
}



function get_KLP_MNN(MNN, res)
{
    console.time('get_KLP_MNN');
    client.connect().then(mongoClient => {
    console.log("Подключение установлено");

    const db = client.db("esklp_service");
    //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
    const col_KLP = db.collection("klp");
    //ищем МНН по имени
    const cursorKLP = col_KLP.find({ 'parent_MNN': MNN }).sort({'trade_name': 1, 'lf_norm_name' : 1});

    //массив возвращаемых документов
    let docs = [];
    //асинхронный вызов получения массива документов
    const allDocuments = cursorKLP.toArray();


    allDocuments.then(arr => {
        arr.forEach(doc => {
            //добавляем в коллекцию документ МНН, но он еще не обогащен подчиненными элементами - это будет асинхронно потом после Promise.all 
            docs.push(doc);
        });}).then(r => {   //после того, как все заполнено, возвращаем KLP
            res.send(docs);
            console.timeEnd('get_KLP_MNN');
        });
    });
}

function get_KLP_smmnn_uuid_list(smnn_uid_list, res)
{
    console.time('get_KLP_smmnn_uuid_list');
    client.connect().then(mongoClient => {
    console.log("Подключение установлено");

    const db = client.db("esklp_service");
    //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
    const col_KLP = db.collection("klp");
    //ищем МНН по имени
    const cursorKLP = col_KLP.find({ 'parent_SMNN_UUID': {$in : smnn_uid_list}}).sort({'trade_name': 1, 'lf_norm_name' : 1});

    //массив возвращаемых документов
    let docs = [];
    //асинхронный вызов получения массива документов
    const allDocuments = cursorKLP.toArray();


    allDocuments.then(arr => {
        arr.forEach(doc => {
            //добавляем в коллекцию документ МНН, но он еще не обогащен подчиненными элементами - это будет асинхронно потом после Promise.all 
            docs.push(doc);
        });}).then(r => {   //после того, как все заполнено, возвращаем KLP
            res.send(docs);
            console.timeEnd('get_KLP_smmnn_uuid_list');
        });
    });
}

function get_KLP_uuid_list(klp_uid_list, res)
{
    console.time('get_KLP_uuid_list');
    client.connect().then(mongoClient => {
    console.log("Подключение установлено");

    const db = client.db("esklp_service");
    //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
    const col_KLP = db.collection("klp");
    //ищем МНН по имени
    const cursorKLP = col_KLP.find({ 'attr_UUID': {$in : klp_uid_list}}).sort({'trade_name': 1, 'lf_norm_name' : 1});

    //массив возвращаемых документов
    let docs = [];
    //асинхронный вызов получения массива документов
    const allDocuments = cursorKLP.toArray();


    allDocuments.then(arr => {
        arr.forEach(doc => {
            //добавляем в коллекцию документ МНН, но он еще не обогащен подчиненными элементами - это будет асинхронно потом после Promise.all 
            docs.push(doc);
        });}).then(r => {   //после того, как все заполнено, возвращаем KLP
            res.send(docs);
            console.timeEnd('get_KLP_uuid_list');
        });
    });
}







app.get('/smnn_by_name/:exact/:with_klp/:only_actual/:name', function(req, res) {
    const name = req.params.name;
    exact = req.params.exact == "1";
    with_klp = req.params.with_klp == "1";
    only_actual = req.params.only_actual == "1";
    get_SMNN(name, only_actual,exact, with_klp, res);
});   


/*
app.get('/mnn_by_name_exact_with_klp/:name', function(req, res) {
    const name = req.params.name;
    get_MNN(name, true, res, true);
}); 

app.get('/mnn_by_name_like/:pattern', function(req, res) {
    const name = req.params.pattern;
    get_MNN(name, false, res, false);
 });   
         
app.get('/mnn_by_name_like_with_klp/:pattern', function(req, res) {
    const name = req.params.pattern;
    get_MNN(name, false, res, true);
 });  */

 app.get('/klp_by_smnn_uuid/:smnn_uid', function(req, res) {
    const smnn_uid = req.params.smnn_uid;
    get_KLP_smmnn_uuid(smnn_uid, res);
 }); 
 
 app.get('/klp_by_smnn_uuid_list/:smnn_uid_list', function(req, res) {
    const smnn_uid_list_str = req.params.smnn_uid_list;
    get_KLP_smmnn_uuid_list(smnn_uid_list_str.split(","), res);
 });


 app.get('/klp_by_uuid_list/:klp_uid_list', function(req, res) {
    const klp_uid_list = req.params.klp_uid_list;
    get_KLP_uuid_list(klp_uid_list.split(","), res);
 });
 
 app.get('/klp_by_mnn/:mnn', function(req, res) {
    const mnn = req.params.mnn;
    get_KLP_MNN(mnn, res);
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
});

