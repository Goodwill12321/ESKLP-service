const MongoClient = require("mongodb").MongoClient;
const fs = require("fs");



const client = new MongoClient("mongodb://127.0.0.1:27017");


client.connect().then((mongoClient => {
  console.log("Подключение установлено");
  //console.log(mongoClient.options.dbName); // получаем имя базы данных
  //console.log("Connected successfully to server");

  let ins = 0;
  let cnt_all = 0;
  let Errors = [];
  const db = client.db("esklp");
  const collection = db.collection("mnn");

  /* function saveData(data) {
     if (data instanceof Object) {
       xml.pause();
       data["key_name"] = data["$"]  
       data["$"] ? delete data["$"] : null;
       collection.insertOne(data).then(result => {
           //console.log(data);
           console.info("➕  ", c);
           xml.resume()}, 
           err =>{
             console.log(data);
             Errors.push(err);
             xml.resume();
           } 
       );
       //xml.resume();
     }
     //console.log(data);
   }*/

  let batchTemp = [];
  function saveDataBatch(data) {
    if (data instanceof Object) {
      if (batchTemp.length < 5) {
        batchTemp.push(data);
        //xml.resume();
        ins++;
        if (ins % 10 == 0)
          console.info("➕  ", ins);
      } else {

        // xml.pause();
        if (batchTemp.includes(data))
          console.log("Duplicate object " + data);
        else {
          batchTemp.push(data);
          collection.insertMany(batchTemp).then(result => {
            //console.log(data);
            console.info("➕  " + ins + " all " + cnt_all);
            batchTemp = [];
            //xml.resume()
          },
            err => {
              console.log(data);
              Errors.push(err);
              //xml.resume();
              batchTemp = [];
            })
        }
      }
    }
  }

  //перенос из children в сам реквизит (уменьшение уровней) в значение key_value. 
  //TODO. Переделать на рекурсию!
  function normalizeProduct(product, product_out) {
   
    product_out = new Object();

    if (product.parent) { //product.parent = null;
      product_out.parent = product.parent
      /*product.parent.children = null;
      product.parent.parent = null;
      /*if (product.parent.parent) {
        product.parent.parent.children = null;
        if (product.parent.parent.parent){
          product.parent.parent.parent.children = null;
          if (product.parent.parent.parent.parent)
            product.parent.parent.parent.children = null;
        } 
      }*/
    }
    for (let rekv in product)
    {
      if (rekv == 'attributes')
      {
        product[""]  
      }
      if(product[rekv] instanceof Object && rekv['name'])
      {
         product[rekv['name'].replace('NS2:', '')] = new Object(); 
      }  
    }
    /*product.children = null;
    if (product['SMNN_LIST']){
      for (child of product['SMNN_LIST'].children)
        for (key in child) {
          rekv = child[key];
          if (rekv['children']) {
            if (rekv['children'].length == 1) {
              rekv['key_value'] = rekv['children'][0];
              rekv['children'] = null;
            }
            else if (rekv['children'].length > 1) {
              for (ch of rekv['children'])
                if (ch['children']) {
                  if (ch['children'].length == 1) {
                    ch['key_value'] = ch['children'][0];
                    ch['children'] = null;
                  } else if (ch['children'].length > 1) {
                    for (ch2 of ch['children'])
                      if (ch2['children']) {
                        if (ch2['children'].length == 1) {
                          ch2['key_value'] = ch2['children'][0];
                          ch2['children'] = null;
                        } else if (ch2['children'].length > 1) {
                          for (ch3 of ch2['children'])
                            if (ch3['children']) {
                              if (ch3['children'].length == 1) {
                                ch3['key_value'] = ch3['children'][0];
                                ch3['children'] = null;
                              }
                            }
                            ch2['children'] = null;
                        }
                      }
                      if (key == 'KLP_LIST')
                        ch['children'] = null;
                  }
                }
            }
          }
          
        }
        child.children = null;
    }*/
  }

  console.log("Current directory:", __dirname);

  /*const streamWrite = fs.createWriteStream("./data/extract.json");
  function saveToFile(data) {
    streamWrite.write(data);
  }*/

  const path = require('path')
  const clientPath = path.join(__dirname, 'data/esklp_20230602_active_21.5_00001_0001.xml')
  //const stream = fs.createReadStream  ("/home/victor/projects/Node/esklp/data/esklp_20230602_active_21.5_00001_0001.xml");


  //var parser = sax.parser(true);

  var sax = require('./sax.js')

  var saxStream = sax.createStream(false)

  const tagCollect = "NS2:GROUP";
  products = []
  cur_ch = undefined
  product = undefined
  currentTag = undefined

  saxStream.on("closetag", function (tagName) {
    cnt_all++;
    if (tagName === tagCollect && product != null) {
      if (product.children.length > 1) {
       // normalizeProduct(product);
        product_clone = cloneTag(product);
        products.push(product_clone)
        saveDataBatch(product_clone)
        currentTag = product = product_clone = null
        return
      }
    }
    if (currentTag && currentTag.parent) {
      var p = currentTag.parent
      delete currentTag.parent
      currentTag = p
    }
    //console.log(tagName);
  })

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

  function cloneTag(tag, copy_parent = 100, copy_children = true, level = 1)
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
          clone['ATTR_' + attr] = tag.attributes[attr];    
        }
      }
      if (copy_children && tag['children']){
        clone.children = [];
        for (let child of tag.children)
        {
          if (child['children'] 
              && child['children'].length == 1 
              && !(child['children'][0] instanceof Object) 
              && child['name']
              )
          {  
            clone[child.name.replace('NS2:', '')] = child['children'][0];
          }
          else if (child['name']  
                  && tag.name.indexOf('LIST') == 0 
                  && (tag.children.length == 1 || tagNameUniq(tag.children, child.name)))
          {
            /*if (level == 1)
              cur_ch = child;*/
            cl_ch = cloneTag(child, 0, true, level + 1);
            clone[child.name.replace('NS2:', '')] = cl_ch;  
          }
          else
          {
            cl_ch = cloneTag(child, 0, true, level + 1);
            clone.children.push(cl_ch);
          }
        }
        if (clone.children.length == 0)
          delete clone.children;
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

  const stream = fs.createReadStream(clientPath)
    .pipe(saxStream);
  //"/home/victor/projects/Node/esklp/data/esklp_20230621_full_21.5_00001_0001.xml");

  //const stream = fs.createReadStream("./esklp/data/1.xml");

  /*const xml = new XmlStream(stream);
 
  xml.preserve('ns2:grouplist', true);
  xml.collect('ns2:group');
  xml.on('endElement: ns2:group', function(item) {
    if (typeof item['ns2:smnn_list'] != 'undefined') 
    {
      saveDataBatch(item);
      ins++;
    }    
    cnt_all++;
    //console.log(item);
  });
  
  xml.on("end", function() {
    // client.close();
    console.error(JSON.stringify(Errors));
    console.log("🔥  END");
  });*/


}), err => {
  console.log(err);
});




/*client.connect(function(err) {
  if (err) {
    throw new Error("db connection error", err);
  }
  console.log("Connected successfully to server");
 
  let c = 0;
  let Errors = [];
  const db = client.db("esklp");
  const collection = db.collection("mnn");
 
  function saveData(data) {
    if (data instanceof Object) {
      xml.pause();
      data["$"] ? delete data["$"] : null;
      collection.insertOne(data, (err, res) => {
        if (err) {
          console.error("insertOne: ", err);
          Errors.push(err);
        } else {
          console.clear();
          console.log(data);
          console.info("➕  ", c);
          xml.resume();
        }
      });
    }
  }
 
  let batchTemp = [];
  function saveDataBatch(data) {
    if (data instanceof Object) {
      xml.pause();
      data["$"] ? delete data["$"] : null;
      if (batchTemp.length < 100) {
        batchTemp.push(data);
      } else {
        batchTemp.push(data);
        collection.insertMany(batchTemp, (err, res) => {
          if (err) {
            console.error("insertMany: ", err);
            Errors.push(err);
          } else {
            console.clear();
            console.log(data);
            console.info("➕  ", c);
            batchTemp = [];
            xml.resume();
          }
        });
      }
    }
  }
 
  const streamWrite = fs.createWriteStream("./data/extract.json");
  function saveToFile(data) {
    streamWrite.write(data);
  }
 
  const stream = fs.createReadStream("./data/esklp_20230602_active_21.5_00001_0001.xml");
  const xml = new XmlStream(stream);
 
  xml.on("endElement: SUBJECT", function(item) {
    saveData(item);
    c++;
  });
 
  xml.on("end", function() {
    // client.close();
    console.error(JSON.stringify(Errors));
    console.log("🔥  END");
  });
});*/