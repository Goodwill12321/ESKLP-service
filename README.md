# ESKLP-service
http service for parsing and giving ESKLP reference by REST API

# parser-sax.js
Загрузчик файлов XML парсером SAX. Путь к файлу передается параметром. База Mongo  - localhost

# main.js
Web-сервис предоставляющий в виде json ответы из базы Mongo  по отборам в справочнике ЕСКЛП
Основные на данный момент (остальные уже не используются, но должны быть рабочими):
get_LP
и 
get_KLP_uuid_list
