let ins = 0;
let cnt_all = 0;

function tagNameUniq(tag_children, child_name)
{
  let cnt = 0;
  for (let ch of tag_children)
  {
    if (ch['name'] && ch.name == child_name)
      cnt ++;
  }
  return cnt < 2;
}


//клонирование структуры тэга с ее упрощением (уменьшение уровней вложенности и убиранием лишних структур - иначе слишком большие структуры не помещаются в бд)
function cloneTag(tag, copy_parent = 100, copy_children = true, level = 1, klpList = undefined, MNN_UUID = "")
{
  let clone = {}; 
  if (tag instanceof Object)
  {
    // новый пустой объект
    if ( tag.name )
      clone.tag_name = tag.name;
    
    if (copy_parent > 0 && tag['parent'])
      clone.parent = cloneTag(tag.parent, copy_parent - 1, false, level + 1);

    if (tag['attributes']){
      for (let attr in tag.attributes)
      {
        clone['attr_' + attr] = tag.attributes[attr];    
      }
    }
    if (copy_children && tag['children'] && tag.children.length > 0)
    {
      if (tag.name == "NS2:KLP_LIST")
      {
          clone.children = [];
          if (typeof klpList == 'undefined')
            klpList = [];
          for (let child of tag.children) 
          { 
            let clChild = cloneTag(child, 100, true, 1);
            clChild.parent_MNN_UUID = MNN_UUID;
            clChild.parent_SMNN_UUID = clone.attr_UUID;
            klpList.push(clChild);
            clone.children.push(clChild.attr_UUID);
          }    
      }
      else if (tag.children.length == 1 //если ребенок один, его можно перенести в реквизит родителя (кроме списков)
        && tag.children[0]['name'] 
        && tag.name.indexOf('LIST') == -1 ) //для списков обязательно должны быть дети, даже если он 1
      {
        child = tag.children[0];
        clone[child.name.replace('NS2:', '')] = child instanceof Object ?  cloneTag(child, 0, true, level + 1, klpList, MNN_UUID) : child;    
      }
      else
      {
        clone.children = [];
        for (let child of tag.children) 
        {
         /* if (tag.name = '')
            klpList*/
          if (child['name']
            && tag.name.indexOf('LIST') == -1) //вместо "детей" - реквизит 
          {
            let chld = child;
            
            if (child['children'] 
                && child.children.length == 1
                && child.name.indexOf('LIST') == -1)
              chld = child.children[0]; //когду у ребенка есть 1 ребенок - то перепрыгиваем через уровень 

            clone[child.name.replace('NS2:', '')] = chld instanceof Object ? cloneTag(chld, 0, true, level + 1, klpList, MNN_UUID) : chld;
          }
          else 
          { 
            let chld = child;
            if (child['children'] 
                && child.children.length == 1
                && child['name']
                && child.name.indexOf('LIST') == -1)
            {
              chld = {};
              chld[child.name] = child.children[0];
            }
            clone.children.push(chld instanceof Object ? cloneTag(chld, 0, true, level + 1, klpList, MNN_UUID) : chld); 
          }

        }
        if (clone.children.length == 0)
          delete clone.children;
      } 
    }
    for (let key in tag)
    {
      if (key != 'attributes' && key != 'name' && key != 'children' && key != 'parent' && key != 'isSelfClosing')
        clone[key] = tag[key];
    }
  }
  else 
    clone = tag;  
  return clone;  
}
  

 


function loadFile(filePath) {
  
  const MongoClient = require("mongodb").MongoClient;
  const fs = require("fs");



  const client = new MongoClient("mongodb://127.0.0.1:27017");

  
  client.connect().then((mongoClient => {
    console.log("Подключение установлено");
    //console.log(mongoClient.options.dbName); // получаем имя базы данных
    //console.log("Connected successfully to server");

    
    let Errors = [];
    products = [];
    klpList = [];

    const db = client.db("esklp");
    const collectionMNN = db.collection("mnn");
    const collectionKLP = db.collection("klp");

      
    let batchTemp = [];
    function saveDataBatch(data) {
      if (data instanceof Object) {
        if (batchTemp.length < 5) {
          batchTemp.push(data);
          //xml.resume();
          ins++;
          /*if (ins % 10 == 0)
            console.info("➕  ", ins);*/
        } else {
  
          // xml.pause();
          if (batchTemp.includes(data))
            console.log("Duplicate object " + data);
          else {
            batchTemp.push(data);
            collectionMNN.insertMany(batchTemp).then(result => {
              //console.log(data);
              console.info("➕  " + ins + " all " + cnt_all);
              //xml.resume()
            },
              err => {
                console.log(data);
                Errors.push(err);
                //xml.resume();
              });
              batchTemp = [];
              collectionKLP.insertMany(klpList).then(result => {
                console.info("klp");
              },
                err => {
                  console.log(err);
                  Errors.push(err);
                });
                klpList = [];
          }
        }
      }
    }

    console.log("Current directory:", __dirname);

    /*const streamWrite = fs.createWriteStream("./data/extract.json");
    function saveToFile(data) {
      streamWrite.write(data);
    }*/

    const path = require('path')
    const clientPath = filePath;//path.join(__dirname, 'data/esklp_20230602_active_21.5_00001_0001.xml')
    //const stream = fs.createReadStream  ("/home/victor/projects/Node/esklp/data/esklp_20230602_active_21.5_00001_0001.xml");


    //var parser = sax.parser(true);

    var sax = require('./sax.js')

    var saxStream = sax.createStream(false)

    const tagCollect = "NS2:GROUP";
    
        
    cur_ch = undefined
    product = undefined
    currentTag = undefined

    saxStream.on("closetag", function (tagName) {
      cnt_all++;
      if (tagName === tagCollect && product != null) {
        if (product.children.length > 1) {
        // normalizeProduct(product);
          product_clone = cloneTag(product, 100, true, 1, klpList, product.attributes.UUID);
          products.push(product_clone)
          saveDataBatch(product_clone)
          currentTag = product = product_clone = null
          return
        }
      }
      if (currentTag && currentTag.parent) {
        var p = currentTag.parent
        //delete currentTag.parent
        currentTag = p
      }
      //console.log(tagName);
    })

    saxStream.on("opentag", function (tag) {
      if (tag.name !== tagCollect && !product) return
      if (tag.name === tagCollect) {
        product = tag;
      }
      tag.parent = currentTag
      tag.children = []
      tag.parent && tag.parent.children.push(tag)
      /*if (tag.parent)
        tag.parent[tag.name.replace('NS2:', '')] = tag;*/
      currentTag = tag
      //console.log(tag.name);
    })

    saxStream.on("text", function (text) {
      if (currentTag)
        currentTag.children.push(text)
      //console.log(text);
    });

    saxStream.on("end", function () {
      console.log("finished document!");
    });

    const stream = fs.createReadStream(clientPath)
      .pipe(saxStream);
  
    }), err => {
    console.log(err);
  });
}

if (require.main === module) {
  if (process.argv.length < 3)
    console.log("Необходимо передать путь к файлу в качестве аргумента");
  else  
    loadFile(process.argv[2]);
}


