const express = require('express')
const bodyParser = require('body-parser')
const { v4: uuidv4 } = require('uuid');

const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(express.json());

app.use(bodyParser.json())



const MongoClient = require("mongodb").MongoClient;
const client = new MongoClient("mongodb://127.0.0.1:27017");


function handleError(error, res) {
    res.statusCode = 500;
    res.send(error);

}

var fs = require('fs');

/*function formatDate(date, delim){
    var options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    };
    return date.toLocaleString("en-UK", options).replaceAll("/", delim);
}*/

const logging = require('./logger.js');

const ftpLoader = require('./ftp-esklp.js');

function regExpEscape(literal_string) {
    return literal_string.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
}


let timers = {};

function timeStart(label){
    timers[label] = performance.now();
    logging('main', label + ' start');
}

function timeEnd(label){
    let dur = performance.now() - timers[label];
    logging('main', label + ' duration : ' + dur + ' ms ');
}



function get_SMNN(name, only_actual, exactly, withKLP, userQuery = undefined, res) {

    try {
        uuid = uuidv4();
        timeStart('get_SMNN.' + uuid);
        client.connect().then(mongoClient => {
            logging('main',"Подключение к БД установлено");

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
                query_name = { 'mnn': { $regex: regExpEscape(name), $options: "i" } };

            if (only_actual) {
                date_end_cond = { $or: [{ "date_end_dt": { $gt: new Date() }, "date_end": { $exists: false } }] };
                query = { $and: [query_name, date_end_cond] };
            }
            else
                query = query_name;

            if (typeof userQuery != 'undefined' && Object.keys(userQuery).length !== 0)
                query = { $and: [query, userQuery] };

            logging('main','query = ' + JSON.stringify(query));
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
                    logging('main',doc);
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
                    timeEnd('get_SMNN.' + uuid);
                }
                );
            });
        });

    } catch (error) {
        console.error(error);
        handleError(error, res);
    }

}

async function get_KLP_UUID_By_Code(klp_code, db)
{
    const col_KLP = db.collection("klp")
    cursor = await col_KLP.find({"code" : klp_code})
    let docs = [];
    const allDocuments = await cursor.toArray();
    if (allDocuments.length > 0)
        return allDocuments[0].attr_UUID
    else
        return null
}

async function get_LP(params, res, next) {

    try {

        uuid = uuidv4();
        timeStart('get_LP.' + uuid);

        mongoClient = await client.connect();
        curDate = new Date();
        logging('main',"******************************");
        logging('main',"get_LP");
        logging('main',curDate + ". Подключение к БД установлено");
        logging('main',"------------------------------");

        const db = client.db("esklp_service");
        //коллекция МНН
        const col_LP = db.collection("lp");
        //ищем МНН по имени
        let cursor = undefined;

        query_name = {};
        if (params.mnn && params.mnn != "") {
            if (params.exactly)
                query_name = { 'mnn': params.mnn };
            else
                query_name = { 'mnn': { $regex: regExpEscape(params.mnn), $options: "i" } };
        }

        if (params.only_actual) {
            date_end_cond = { $or: [{ "date_end": { $gt: new Date() }, "date_end": { $exists: false } }] };
            if (Object.keys(query_name).length !== 0)
                query = { $and: [query_name, date_end_cond] };
            else
                query = date_end_cond;
        }
        else
            query = query_name;

        if ((Object.keys(query_name).length == 0) && ('trade_name' in params) && params.trade_name != "") {
            query = { "mnn": { $ne: "" } };
        }

        if ('trade_name' in params)
            if (params.exactly)
                query = { $and: [query, { "trade_name": params.trade_name }] };
            else
                query = { $and: [query, { "trade_name": { $regex: regExpEscape(params.trade_name), $options: "i" } }] };

        if ('dosage' in params)
            if (params.exactly)
                query = { $and: [query, { $or: [{ "dosage_norm_name": params.dosage }, { "dosage_unit_name": params.dosage }] }] };
            else
                query = { $and: [query, { $or: [{ "dosage_norm_name": { $regex: regExpEscape(params.dosage), $options: "i" } }, { "dosage_unit_name": { $regex: regExpEscape(params.dosage), $options: "i" } }] }] };

        if ('lek_form' in params)
            if (params.exactly)
                query = { $and: [query, { "form": params.lek_form }] };
            else
                query = { $and: [query, { "form": { $regex: regExpEscape(params.lek_form), $options: "i" } }] };
        if ('pack_1_name' in params)
            if (params.exactly)
                query = { $and: [query, { "pack1_name": params.pack_1_name }] };
            else
                query = { $and: [query, { "pack1_name": { $regex: regExpEscape(params.pack_1_name), $options: "i" } }] };
        if ('manufacturer' in params)
            //if (params.exactly)
            //    query = { $and: [query, { "manufacturer_name": params.manufacturer }] };
            //else
                query = { $and: [query, { "manufacturer_name": { $regex: regExpEscape(params.manufacturer), $options: "i" } }] };
        if ('num_reg' in params)
            query = { $and: [query, { "num_reg": params.num_reg }] };

        if ('klp_code' in params)
        {
            klp_UUID = await get_KLP_UUID_By_Code(params.klp_code, db);
            query = { $and: [query, {"klpList" : {$elemMatch: {$eq : klp_UUID}}}] };
        }
            

        logging('main','query = ' + JSON.stringify(query));

        distinct = false;
        if ('distinct' in params) {
            distinct = true;
            distinct_fields = params.distinct;
        }


        cursor = col_LP.find(query).sort({ 'mnn': 1, 'trade_name': 1, 'date_change': -1, 'lf_norm_name': 1, 'dosage_norm_name': 1 }).collation({ locale: 'ru', strength: 1 });


        //массив возвращаемых документов
        let docs = [];
        //асинхронный вызов получения массива документов
        const arr = await cursor.toArray();

        res_doc = {};
        if (distinct) {
            docs.push(res_doc);
            for (field of distinct_fields)
                res_doc[field] = [];
        }
        arr.forEach(doc => {
            //добавляем в коллекцию документ МНН
            if (distinct) {
                for (field of distinct_fields)
                    if (res_doc[field].indexOf(doc[field]) == -1)
                        res_doc[field].push(doc[field]);
            }
            else {
                // logging('main',doc);
                docs.push(doc);
            }

        });

        //ждем все обработки всех массивов. promises - это массив промисов, каждый из которых возвращает массив КЛП. 
        // Т.е. результатом ожидания будет массив массивов arraysKLP
        logging('main','get_LP.' + uuid + '. Получено ЛП ' + docs.length);
        res.send(docs);
        timeEnd('get_LP.' + uuid);
        logging('main',"------------------------------");
        logging('main',"******************************");
        
    } catch (error) {
        console.error(error);
        handleError(error, res);
    }
}


function get_KLP_smmnn_uuid(smnn_uid, res) {
    try {
        uuid = uuidv4();
        timeStart('get_KLP_smmnn_uuid.' + uuid);
        client.connect().then(mongoClient => {
            logging('main',"Подключение к БД установлено");

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
                timeEnd('get_KLP_smmnn_uuid.' + uuid);
            });
        });
    } catch (error) {
        console.error(error);
        handleError(error, res);
    }
}


function get_MNN_part_name(part_name, res) {
    try {
        uuid = uuidv4();
        timeStart('get_MNN_part_name.' + uuid);
        client.connect().then(mongoClient => {
            logging('main',"Подключение к БД установлено");

            const db = client.db("esklp_service");
            //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
            const col_MNN = db.collection("mnn");
            //ищем МНН по имени
            const cursorMNN = col_MNN.find({ "attr_name": { $regex: regExpEscape(part_name), $options: "i" } }).sort({ 'attr_name': 1});;

            //массив возвращаемых документов
            let docs = [];
            //асинхронный вызов получения массива документов
            const allDocuments = cursorMNN.toArray();


            allDocuments.then(arr => {
                arr.forEach(doc => {
                    //добавляем в коллекцию документ МНН, но он еще не обогащен подчиненными элементами - это будет асинхронно потом после Promise.all 
                    docs.push(doc);
                });
            }).then(r => {   //после того, как все заполнено, возвращаем KLP
                res.send(docs);
                timeEnd('get_MNN_part_name.' + uuid + ". Count " + docs.length);
            });
        });
    } catch (error) {
        console.error(error);
        handleError(error, res);
    }
}



function get_KLP_MNN(MNN, res) {
    try {
        uuid = uuidv4();
        timeStart('get_KLP_MNN.'+ uuid);
        client.connect().then(mongoClient => {
            logging('main',"Подключение к БД установлено");

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
                timeEnd('get_KLP_MNN.' + uuid);
            });
        });
    } catch (error) {
        console.error(error);
        handleError(error, res);
    }
}

function get_KLP_smmnn_uuid_list(smnn_uid_list, res) {
    try {
        uuid = uuidv4();
        timeStart('get_KLP_smmnn_uuid_list.' + uuid);
        client.connect().then(mongoClient => {
            logging('main',"Подключение к БД установлено");

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
                timeEnd('get_KLP_smmnn_uuid_list.' + uuid);
            });
        });
    } catch (error) {
        console.error(error);
        handleError(error, res);
    }
}

function get_KLP_uuid_list(klp_uid_list, params, res) {
    try {
        uuid = uuidv4();
        timeStart('get_KLP_uuid_list.' + uuid);
        client.connect().then(mongoClient => {
            curDate = new Date();

            logging('main',"******************************");
            logging('main',"get_KLP_uuid_list");
            logging('main',curDate + ". Подключение к БД установлено");
            logging('main',"------------------------------");
            const db = client.db("esklp_service");
            //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
            const col_KLP = db.collection("klp");
            //ищем МНН по имени

            userQuery = { 'attr_UUID': { $in: klp_uid_list } };


            if ('trade_name' in params)
                if (params.exactly)
                    userQuery = { $and: [userQuery, { "trade_name": params.trade_name }] };
                else
                    userQuery = { $and: [userQuery, { "trade_name": { $regex: regExpEscape(params.trade_name), $options: "i" } }] };

            if ('dosage' in params)
                if (params.exactly)
                    query = { $and: [userQuery, { "dosage_norm_name": params.dosage }] };
                else
                    query = { $and: [userQuery, { "dosage_norm_name": { $regex: regExpEscape(params.dosage), $options: "i" } }] };
            if ('lek_form' in params)
                if (params.exactly)
                    query = { $and: [userQuery, { "lf_norm_name": params.lek_form }] };
                else
                    query = { $and: [userQuery, { "lf_norm_name": { $regex: regExpEscape(params.lek_form), $options: "i" } }] };
            //userQuery = { $and: [userQuery, { "lf_norm_name": params.lek_form }] };
            if ('pack_1_name' in params)
                if (params.exactly)
                    query = { $and: [userQuery, { "pack_1.name": params.pack_1_name }] };
                else
                    query = { $and: [userQuery, { "pack_1.name": { $regex: regExpEscape(params.pack_1_name), $options: "i" } }] };
            //userQuery = { $and: [userQuery, { "pack_1.name": params.pack_1_name }] };
            if ('num_reg' in params)
                userQuery = { $and: [userQuery, { "num_reg": params.num_reg }] };
            if ('lim_price' in params)
                userQuery = { $and: [userQuery, { "klp_lim_price_list.children.price_value": params.lim_price }] };
            if ('barcode' in params)
                userQuery = { $and: [userQuery, { "klp_lim_price_list.children.barcode": params.barcode }] };


            if ('manufacturer' in params)
                if (params.exactly)
                    userQuery = { $and: [userQuery, { "manufacturer.name": params.manufacturer }] };
                else
                    userQuery = { $and: [userQuery, { "manufacturer.name": { $regex: regExpEscape(params.manufacturer), $options: "i" } }] };

            logging('main','query = ' + JSON.stringify(userQuery));

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
                logging('main','get_KLP_uuid_list.' + uuid + '. Получено КЛП по списку UUID ' + docs.length);
                timeEnd('get_KLP_uuid_list.' + uuid);
                logging('main',"------------------------------");
                logging('main',"******************************");
            });
        });
    } catch (error) {
        console.error(error);
        handleError(error, res);
    }
}


function get_KLP_by_price(trade_name, params, res) {
    try {
        uuid = uuidv4();
        timeStart('get_KLP_by_price.' + uuid);
        client.connect().then(mongoClient => {
            curDate = new Date();
            logging('main',"******************************");
            logging('main',"get_KLP_by_price");
            logging('main',curDate + ". Подключение к БД установлено");
            logging('main',"------------------------------");

            const db = client.db("esklp_service");
            //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
            const col_KLP = db.collection("klp");
            //ищем МНН по имени

            if (trade_name != '')
                userQuery = { 'trade_name': { $regex: regExpEscape(trade_name), $options: "i" } };
            else
                userQuery = { 'trade_name': { $ne: "" } }

            if ('num_reg' in params)
                userQuery = { $and: [userQuery, { "num_reg": params.num_reg }] };
            if ('lim_price' in params)
                userQuery = { $and: [userQuery, { "klp_lim_price_list.children.price_value": params.lim_price }] };
            if ('barcode' in params)
                userQuery = { $and: [userQuery, { "klp_lim_price_list.children.barcode": params.barcode }] };


            if ('manufacturer' in params)
                if (params.exactly)
                    userQuery = { $and: [userQuery, { "manufacturer.name": params.manufacturer }] };
                else
                    userQuery = { $and: [userQuery, { "manufacturer.name": { $regex: regExpEscape(params.manufacturer), $options: "i" } }] };


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
                        "smnn_replace_list": 0
                    }
                }
            ];

            logging('main','query = ' + JSON.stringify(query));

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
                logging('main','get_KLP_by_price.' + uuid + '. Получено КЛП по цене ' + docs.length);
                timeEnd('get_KLP_by_price.' + uuid);
                logging('main',"------------------------------");
                logging('main',"******************************");
            });
        });
    } catch (error) {
        console.error(error);
        handleError(error, res);
    }
}


function test_Func()
{
    
}

function get_Update_ESKLP_Date(res) {
    try {
        uuid = uuidv4();
        timeStart('get_Update_ESKLP_Date.'+ uuid);
        client.connect().then(mongoClient => {
            logging('main', "Connected to DB");

            const db = client.db("esklp_service");
            //подчиненная коллекция КЛП (связываются по внешнему ключу parent_SMNN_UUID с элементами SMNN_LIST элемента MNN)
            const connLoad_info = db.collection("load_info");
            //ищем МНН по имени
            const cursorLoadDate = connLoad_info.find().sort({"update_time" : -1}).limit(1);

            //массив возвращаемых документов
            let docs = [];
            //асинхронный вызов получения массива документов
            const allDocuments = cursorLoadDate.toArray();


            allDocuments.then(arr => {
                arr.forEach(doc => {
                    //добавляем в коллекцию документ МНН, но он еще не обогащен подчиненными элементами - это будет асинхронно потом после Promise.all 
                    docs.push(doc);
                });
            }).then(r => {   //после того, как все заполнено, возвращаем KLP
                res.send(docs);
                timeEnd('get_Update_ESKLP_Date.' + uuid);
            });
        });
    } catch (error) {
        console.error(error);
        handleError(error, res);
    }
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

app.get('/MNN_by_partname/:mnn', function (req, res) {
    const mnn = req.params.mnn;
    get_MNN_part_name(mnn, res);
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
    logging('main',data);
    // добавляем полученные данные к постам
    posts.push(data);
    // чтобы не было бесконечного цикла - вернем все посты на страницу
    return res.send(posts);
});*/


function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }
    res.status(500);
    res.render('error', { error: err });
}


app.get('/update_esklp', function (req, res) {
    ftpLoader.loadLastFile(); 
    res.send('loading new file was executed ' + new Date());    
});

app.get('/get_update_esklp_date', function (req, res) {
    get_Update_ESKLP_Date(res);  
});



app.use(errorHandler);

process.on('uncaughtException', (error) => {
    //errorHandler.handleError(error);
    //if (!errorHandler.isTrustedError(error)) {
    //  process.exit(1);
    //}
    console.error(error.message);
});

const port = process.env.PORT || 3000

app.listen(port, (err) => {
    logging('main',`Server run on ${port} port`)
});

