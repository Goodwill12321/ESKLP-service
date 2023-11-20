const express = require('express')
const bodyParser = require('body-parser')
const { v4: uuidv4 } = require('uuid');

const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(express.json());

app.use(bodyParser.json())

const port = process.env.PORT || 3000

const MongoClient = require("mongodb").MongoClient;
const client = new MongoClient("mongodb://127.0.0.1:27017");


function get_SMNN(name, only_actual, exactly, withKLP, userQuery = undefined, res) {
    console.time('get_SMNN');
    client.connect().then(mongoClient => {
        console.log("Подключение к БД установлено");

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
            query_name = { 'mnn': { $regex: name, $options: "i" } };

        if (only_actual)
        {
            date_end_cond = {$or: [ { "date_end_dt": {$gt : new Date()}, "date_end": { $exists: false } }]};
            query = { $and: [query_name, date_end_cond] };
        }    
        else
            query = query_name;

        if (typeof userQuery != 'undefined' && Object.keys(userQuery).length !== 0)
            query = { $and: [query, userQuery] };

        console.log('query = ' + JSON.stringify(query));
        cursor = col_MNN.find(query).sort({ 'attr_name': 1 }).collation({ locale: 'ru', strength: 1 });

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


function regExpEscape(literal_string) {
    return literal_string.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}


function get_LP(params, res) {
    uuid = uuidv4();
    console.time('get_LP.' + uuid);

    client.connect().then(mongoClient => {
        curDate = new Date();
        console.log("******************************");
        console.log("get_LP");
        console.log(curDate + ". Подключение к БД установлено");
        console.log("------------------------------");
      
        const db = client.db("esklp_service");
        //коллекция МНН
        const col_LP = db.collection("lp");
        //ищем МНН по имени
        let cursor = undefined;

        query_name = {};
        if (params.mnn && params.mnn != "")
        {
            if (params.exactly)
                query_name = { 'mnn': params.mnn };
            else
                query_name = { 'mnn': { $regex: params.mnn, $options: "i" } };
        }    

        if (params.only_actual)
        {
            date_end_cond = {$or: [ { "date_end_dt": {$gt : new Date()}, "date_end": { $exists: false } }]};
            if(Object.keys(query_name).length !== 0)
                query = { $and: [query_name, date_end_cond] };
            else
                query = date_end_cond;
        }    
        else
            query = query_name;

        if ((Object.keys(query_name).length == 0) && ('trade_name' in params) && params.trade_name != "")
        {
            query = {"mnn" : {$ne: ""} };   
        }

        if ('trade_name' in params)
            if (params.exactly)
                query = { $and: [query, { "trade_name": params.trade_name }] };
            else
                query = { $and: [query, { "trade_name": { $regex: params.trade_name, $options: "i" }  }] };
        
        if ('dosage' in params)
            if (params.exactly)
                query = {$and :[query, { $or: [{ "dosage_norm_name": params.dosage }, { "dosage_unit_name": params.dosage }] }]};
            else
                query = { $and: [query, { $or: [{ "dosage_norm_name": { $regex: regExpEscape(params.dosage), $options: "i" }  }, { "dosage_unit_name": { $regex: regExpEscape(params.dosage), $options: "i" }  }] }]};
        
        if ('lek_form' in params)
            if (params.exactly)
                query = { $and: [query, { "lf_norm_name": params.lek_form }] };
            else
                query = { $and: [query, { "lf_norm_name": { $regex: params.lek_form, $options: "i" }  }] };
        if ('pack_1_name' in params)
            if (params.exactly)
                query = { $and: [query, { "pack1_name": params.pack_1_name }] };
            else
                query = { $and: [query, { "pack1_name": { $regex: params.pack_1_name, $options: "i" }  }] };    
        if ('manufacturer' in params)
            if (params.exactly)
                query = { $and: [query, { "manufacturer_name": params.manufacturer}] };
            else
                query = { $and: [query, { "manufacturer_name": { $regex: params.manufacturer, $options: "i" } }] };
        if ('num_reg' in params)
            query = { $and: [query, { "num_reg": params.num_reg }] };           

        console.log('query = ' + JSON.stringify(query));
        
        distinct = false;
        if ('distinct' in params)
        {
            distinct = true;
            distinct_fields = params.distinct;
        }


        cursor = col_LP.find(query).sort({ 'mnn': 1, 'trade_name': 1, 'date_change': -1, 'lf_norm_name': 1, 'dosage_norm_name': 1 }).collation({ locale: 'ru', strength: 1 });

        
        //массив возвращаемых документов
        let docs = [];
        //асинхронный вызов получения массива документов
        const allDocuments = cursor.toArray();

       
        allDocuments.then(arr => {
            res_doc = {};
            if (distinct)
            {
                docs.push(res_doc);
                for(field of distinct_fields)
                    res_doc[field] = [];
            }    
            arr.forEach(doc => {
                //добавляем в коллекцию документ МНН
                if (distinct)
                {
                    for(field of distinct_fields)
                        if (res_doc[field].indexOf(doc[field]) == -1)
                            res_doc[field].push(doc[field]);
                }
                else
                {
                   // console.log(doc);
                    docs.push(doc);
                }

            });

            //ждем все обработки всех массивов. promises - это массив промисов, каждый из которых возвращает массив КЛП. 
            // Т.е. результатом ожидания будет массив массивов arraysKLP
            console.log('get_LP.' +uuid + '. Получено ЛП ' + docs.length);
            res.send(docs);
            console.timeEnd('get_LP.' + uuid);
            console.log("------------------------------");
            console.log("******************************");
        });
        ;

    });
}


function get_KLP_smmnn_uuid(smnn_uid, res) {
    console.time('get_KLP_smmnn_uuid');
    client.connect().then(mongoClient => {
        console.log("Подключение к БД установлено");

        const db = client.db("esklp_service");
        //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
        const col_KLP = db.collection("klp");
        //ищем МНН по имени
        const cursorKLP = col_KLP.find({ 'parent_SMNN_UUID': smnn_uid }).sort({ 'trade_name': 1, 'lf_norm_name': 1 });

        //массив возвращаемых документов
        let docs = [];
        //асинхронный вызов получения массива документов
        const allDocuments = cursorKLP.toArray();


        allDocuments.then(arr => {
            arr.forEach(doc => {
                //добавляем в коллекцию документ МНН, но он еще не обогащен подчиненными элементами - это будет асинхронно потом после Promise.all 
                docs.push(doc);
            });
        }).then(r => {   //после того, как все заполнено, возвращаем KLP
            res.send(docs);
            console.timeEnd('get_KLP_smmnn_uuid');
        });
    });
}



function get_KLP_MNN(MNN, res) {
    console.time('get_KLP_MNN');
    client.connect().then(mongoClient => {
        console.log("Подключение к БД установлено");

        const db = client.db("esklp_service");
        //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
        const col_KLP = db.collection("klp");
        //ищем МНН по имени
        const cursorKLP = col_KLP.find({ 'parent_MNN': MNN }).sort({ 'trade_name': 1, 'lf_norm_name': 1 });

        //массив возвращаемых документов
        let docs = [];
        //асинхронный вызов получения массива документов
        const allDocuments = cursorKLP.toArray();


        allDocuments.then(arr => {
            arr.forEach(doc => {
                //добавляем в коллекцию документ МНН, но он еще не обогащен подчиненными элементами - это будет асинхронно потом после Promise.all 
                docs.push(doc);
            });
        }).then(r => {   //после того, как все заполнено, возвращаем KLP
            res.send(docs);
            console.timeEnd('get_KLP_MNN');
        });
    });
}

function get_KLP_smmnn_uuid_list(smnn_uid_list, res) {
    console.time('get_KLP_smmnn_uuid_list');
    client.connect().then(mongoClient => {
        console.log("Подключение к БД установлено");

        const db = client.db("esklp_service");
        //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
        const col_KLP = db.collection("klp");
        //ищем МНН по имени
        const cursorKLP = col_KLP.find({ 'parent_SMNN_UUID': { $in: smnn_uid_list } }).sort({ 'trade_name': 1, 'lf_norm_name': 1 });

        //массив возвращаемых документов
        let docs = [];
        //асинхронный вызов получения массива документов
        const allDocuments = cursorKLP.toArray();


        allDocuments.then(arr => {
            arr.forEach(doc => {
                //добавляем в коллекцию документ МНН, но он еще не обогащен подчиненными элементами - это будет асинхронно потом после Promise.all 
                docs.push(doc);
            });
        }).then(r => {   //после того, как все заполнено, возвращаем KLP
            res.send(docs);
            console.timeEnd('get_KLP_smmnn_uuid_list');
        });
    });
}

function get_KLP_uuid_list(klp_uid_list, params, res) {
    uuid = uuidv4();
    console.time('get_KLP_uuid_list.' + uuid);
    client.connect().then(mongoClient => {
        curDate = new Date();
        
        console.log("******************************");
        console.log("get_KLP_uuid_list");
        console.log(curDate + ". Подключение к БД установлено");
        console.log("------------------------------");
        const db = client.db("esklp_service");
        //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
        const col_KLP = db.collection("klp");
        //ищем МНН по имени

        userQuery = { 'attr_UUID': { $in: klp_uid_list } };

        
        if ('trade_name' in params)
            if (params.exactly)
                userQuery = { $and: [userQuery, { "trade_name": params.trade_name }] };
            else
                userQuery = { $and: [userQuery, { "trade_name": { $regex: params.trade_name, $options: "i" }  }] };

        if ('dosage' in params)
            if (params.exactly)
                query = { $and: [userQuery, { "dosage_norm_name": params.dosage }] };
            else
                query = { $and: [userQuery, { "dosage_norm_name": { $regex: params.dosage, $options: "i" }  }] };
        if ('lek_form' in params)
            if (params.exactly)
                query = { $and: [userQuery, { "lf_norm_name": params.lek_form }] };
            else
                query = { $and: [userQuery, { "lf_norm_name": { $regex: params.lek_form, $options: "i" }  }] };
            //userQuery = { $and: [userQuery, { "lf_norm_name": params.lek_form }] };
        if ('pack_1_name' in params)
            if (params.exactly)
                query = { $and: [userQuery, { "pack_1.name": params.pack_1_name }] };
            else
                query = { $and: [userQuery, { "pack_1.name": { $regex: params.pack_1_name, $options: "i" }  }] };    
            //userQuery = { $and: [userQuery, { "pack_1.name": params.pack_1_name }] };
        if ('num_reg' in params)
            userQuery = { $and: [userQuery, { "num_reg": params.num_reg }] };
        if ('lim_price' in params)
            userQuery = { $and: [userQuery, { "klp_lim_price_list.children.price_value": params.lim_price }] };
        if ('barcode' in params)
            userQuery = { $and: [userQuery, { "klp_lim_price_list.children.barcode": params.barcode }] };
        
        
        if ('manufacturer' in params)
            if (params.exactly)
                userQuery = { $and: [userQuery, { "manufacturer.name": params.manufacturer}] };
            else
                userQuery = { $and: [userQuery, { "manufacturer.name": { $regex: params.manufacturer, $options: "i" } }] };
        
        console.log('query = ' + JSON.stringify(userQuery));

        const cursorKLP = col_KLP.find(userQuery).sort({ 'trade_name': 1, 'lf_norm_name': 1, 'dosage_norm_name': 1, 'consumer_total': 1 });

        //массив возвращаемых документов
        let docs = [];
        //асинхронный вызов получения массива документов
        const allDocuments = cursorKLP.toArray();


        allDocuments.then(arr => {
            arr.forEach(doc => {
                //добавляем в коллекцию документ МНН, но он еще не обогащен подчиненными элементами - это будет асинхронно потом после Promise.all 
                docs.push(doc);
            });
        }).then(r => {   //после того, как все заполнено, возвращаем KLP
            res.send(docs);
            console.log('get_KLP_uuid_list.' + uuid + '. Получено КЛП по списку UUID ' + docs.length);
            console.timeEnd('get_KLP_uuid_list.' + uuid);
            console.log("------------------------------");
            console.log("******************************");
        });
    });
}


function get_KLP_by_price(trade_name, params, res) {
    uuid = uuidv4();
    console.time('get_KLP_by_price.' + uuid);
    client.connect().then(mongoClient => {
        curDate = new Date();
        console.log("******************************");
        console.log("get_KLP_by_price");
        console.log(curDate + ". Подключение к БД установлено");
        console.log("------------------------------");
        
        const db = client.db("esklp_service");
        //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
        const col_KLP = db.collection("klp");
        //ищем МНН по имени

        if (trade_name != '')
            userQuery = { 'trade_name': { $regex: trade_name, $options : "i" } };
        else
            userQuery = { 'trade_name': {$ne: ""} }

        if ('num_reg' in params)
            userQuery = { $and: [userQuery, { "num_reg": params.num_reg }] };
        if ('lim_price' in params)
            userQuery = { $and: [userQuery, { "klp_lim_price_list.children.price_value": params.lim_price }] };
        if ('barcode' in params)
            userQuery = { $and: [userQuery, { "klp_lim_price_list.children.barcode": params.barcode }] };
        
        
        if ('manufacturer' in params)
            if (params.exactly)
                userQuery = { $and: [userQuery, { "manufacturer.name": params.manufacturer}] };
            else
                userQuery = { $and: [userQuery, { "manufacturer.name": { $regex: params.manufacturer, $options: "i" } }] };
        
       
        // const cursorKLP = col_KLP.find(userQuery).sort({ 'trade_name': 1, 'lf_norm_name': 1, 'dosage_norm_name': 1, 'consumer_total': 1 });
        query = [
            {
            $match: 
                userQuery
            },
            {
            $lookup: {
                from: 'smnn',
                localField: 'parent_SMNN_UUID',
                foreignField: 'attr_UUID',
                as: 'smnn_parent'
            }
            },
            { $unwind: { path: '$smnn_parent' } },
            {
                $project: {
                  "smnn_parent.parent": 0,
                  "smnn_parent.klp_list": 0,
                  "smnn_replace_list" : 0
                }
            } 
        ];

        console.log('query = ' + JSON.stringify(query));

        const cursorKLP = col_KLP.aggregate(query
                ,
            { //maxTimeMS: 60000, allowDiskUse: true 
            }
          ).sort({ 'trade_name': 1, 'lf_norm_name': 1, 'dosage_norm_name': 1, 'consumer_total': 1 });;
        //массив возвращаемых документов
        let docs = [];
        //асинхронный вызов получения массива документов
        const allDocuments = cursorKLP.toArray();


        allDocuments.then(arr => {
            arr.forEach(doc => {
                //добавляем в коллекцию документ МНН, но он еще не обогащен подчиненными элементами - это будет асинхронно потом после Promise.all 
                docs.push(doc);
            });
        }).then(r => {   //после того, как все заполнено, возвращаем KLP
            res.send(docs);
            console.log('get_KLP_by_price.' + uuid + '. Получено КЛП по цене ' + docs.length);
            console.timeEnd('get_KLP_by_price.' + uuid);
            console.log("------------------------------");
            console.log("******************************");
        });
    });
}




app.get('/smnn_by_name/:exact/:with_klp/:only_actual/:name', function (req, res) {
    const name = req.params.name;
    exact = req.params.exact == "1";
    with_klp = req.params.with_klp == "1";
    only_actual = req.params.only_actual == "1";

    userQuery = {};
    /* if ('trade_name' in req.query)
         userQuery =  {$and : [userQuery, {"klp_list.LekPreps.trade_name" : req.query.trade_name}]};
     if ('dosage' in req.query)
         userQuery =  {$and : [userQuery, {"klp_list.LekPreps.dosage_norm_name" : req.query.dosage}]};
     if ('lek_form' in req.query)
         userQuery =  {$and : [userQuery, {"klp_list.LekPreps.lf_norm_name" : req.query.lek_form}]};
     if ('pack_1_name' in req.query)
         userQuery =  {$and : [userQuery, {"klp_list.LekPreps.pack1_name" : req.query.pack_1_name}]};
     if ('manufacturer' in req.query)
         userQuery =  {$and : [userQuery, {"klp_list.LekPreps.manufacturer_name" : req.query.manufacturer}]};**/

    get_SMNN(name, only_actual, exact, with_klp, userQuery, res);
});



app.post('/lp_by_name', function (req, res) {

    /*  const name = req.params.mnn;
      exact = req.params.exact == "1";
      only_actual = req.params.only_actual == "1";*/

    /* userQuery = {};
     if ('trade_name' in req.query)
         userQuery = { $and: [userQuery, { "trade_name": req.query.trade_name }] };
     if ('dosage' in req.query)
         userQuery = { $and: [userQuery, { "dosage_norm_name": req.query.dosage }] };
     if ('lek_form' in req.query)
         userQuery = { $and: [userQuery, { "lf_norm_name": req.query.lek_form }] };
     if ('pack_1_name' in req.query)
         userQuery = { $and: [userQuery, { "pack1_name": req.query.pack_1_name }] };
     if ('manufacturer' in req.query)
         userQuery = { $and: [userQuery, { "manufacturer_name": req.query.manufacturer }] };*/

    const klp_uid_list = req.body;
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        req_body = JSON.parse(body);
        get_LP(req_body.params, res);
        // get_KLP_uuid_list(req_body.klp_uid_list, req_body.params, res);
    });


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

app.get('/klp_by_smnn_uuid/:smnn_uid', function (req, res) {
    const smnn_uid = req.params.smnn_uid;
    get_KLP_smmnn_uuid(smnn_uid, res);
});

app.get('/klp_by_smnn_uuid_list/:smnn_uid_list', function (req, res) {
    const smnn_uid_list_str = req.params.smnn_uid_list;
    get_KLP_smmnn_uuid_list(smnn_uid_list_str.split(","), res);
});


const urlencodedParser = bodyParser.urlencoded({ extended: false });

app.post('/klp_by_uuid_list', function (req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        req_body = JSON.parse(body);
        get_KLP_uuid_list(req_body.klp_uid_list, req_body.params, res);
    });
});


app.post('/klp_by_lim_price', function (req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        req_body = JSON.parse(body);
        get_KLP_by_price(req_body.trade_name, req_body.params, res);
    });
});


app.get('/klp_by_mnn/:mnn', function (req, res) {
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

app.listen(port, () => {
    console.log(`Server run on ${port} port`)
});

