exports.getDate = function () {
    var day = new Date();
    options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    return day.toLocaleDateString("en-US", options);
}

exports.getDay = function () {
    var day = new Date();
    options = {
        weekday: 'long'
    };
    return day.toLocaleDateString("en-US", options);
}