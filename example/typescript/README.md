# Azure ADLS Uploader basic example

## Prerequisites
You should to generate SAS URL using [azure portal](https://portal.azure.com):
1. Go to your storage account
2. Open Settings -> Shared access signature
3. Set that things:
    * Allowed services - Blob
    * Allowed resource types - Object
    * Allowed permissions - Write & Create
    * Allowed protocols - HTTPS and HTTP
4. Click Generate SAS and connection string
5. Copy & paste SAS token to `sasToken` variable in `src/main.ts`
6. Copy & paste blob connection string to `url` variable in `src/main.ts`

Also, you may need to update CORS. [azure docs](https://docs.microsoft.com/en-us/rest/api/storageservices/cross-origin-resource-sharing--cors--support-for-the-azure-storage-services)

## How to run
* `npm install` - install dependencies
* `npm run build` - build project (webpack)
* open `dist\index.html` file in browser
