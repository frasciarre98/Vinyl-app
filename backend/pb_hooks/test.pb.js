routerAdd("GET", "/api/test", (e) => {
    let typeRequestInfo = typeof e.requestInfo;
    let typeRequest = typeof e.request;
    return e.json(200, { requestInfo: typeRequestInfo, request: typeRequest });
});
