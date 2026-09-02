routerAdd("POST", "/api/test-body", (e) => {
    let data = new DynamicModel({
        apiKey: "",
        mood: ""
    });
    e.bindBody(data);
    return e.json(200, { key: data.apiKey, mood: data.mood });
});
