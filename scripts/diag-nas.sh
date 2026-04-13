#!/bin/bash
echo "🔍 DIAGNOSTIC POCKETBASE (NAS)"
echo "------------------------------"
C_NAME="vinyl-app-deploy-vinyl-app-1"

echo "1. Elenco Collezioni..."
docker exec $C_NAME /pb/pocketbase collections list | grep vinyls

echo "2. Test Accesso Pubblico (List Vinyls)..."
RESPONSE=$(docker exec $C_NAME curl -s http://127.0.0.1:8090/api/collections/vinyls/records?perPage=1)
if [[ $RESPONSE == *"totalItems"* ]]; then
    echo "✅ API PUBBLICA FUNZIONANTE: $(echo $RESPONSE | grep -o '\"totalItems\":[0-9]*')"
else
    echo "❌ API PUBBLICA FALLITA: $RESPONSE"
fi

echo "3. Controllo Regole..."
docker exec $C_NAME /pb/pocketbase collections show vinyls | grep -E "listRule|viewRule"
