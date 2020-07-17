var express = require('express'),
    app = express(),
    port = process.env.PORT || 3000;

var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'bbva.seguro.mascotas@gmail.com',
        pass: 'p3t#1n5uranc3'
    }
});
var bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin,X-Requested-Width-Content-Type,Accept");
    next();
});

var requestjson = require('request-json');

var urlPets = "https://api.mlab.com/api/1/databases/gdiaz/collections/pets?apiKey=GOLqWa850qO8tsdCUdby6eq9eKPInBkt";
var urlClients = "https://api.mlab.com/api/1/databases/gdiaz/collections/Clientes?apiKey=GOLqWa850qO8tsdCUdby6eq9eKPInBkt";
var urlInsurancePois = "https://api.mlab.com/api/1/databases/gdiaz/collections/insurance-pois?apiKey=GOLqWa850qO8tsdCUdby6eq9eKPInBkt";
app.listen(port);

console.log('todo list RESTful API server started on: ' + port);

// GET PETS
app.get('/Pets', function(req, res) {
  var petsMLab = requestjson.createClient(urlPets);
  petsMLab.get('', function(err, resM, body) {
      if (err) {
          res.status(404).send('Error al obtener mascotas');
      } else {
          res.status(200).send(body);
      }
  })
});

// INSERT QUOTE OF CLIENTS
app.post('/Clientes', function(req, res) {
    var email = req.body.email;
    var password = req.body.password;

    var query = 'q={"email":"' + email + '","password":"' + password + '"}';

    let searchCliente = requestjson.createClient(urlClients + "&" + query);
    searchCliente.get('', function(err, resM, body) {
        if (!err) {
            // ENVIO MAIL
            let textMail = `Estimado ${req.body.name}: El costo anual del seguro de ${req.body.quote[0].petName} es de ${req.body.quote[0].insurancePrice} MXN.`;
            let htmlMail = `Estimado ${req.body.name}: <br><br> El costo anual del seguro de <strong>${req.body.quote[0].petName}</strong> es de <strong>${req.body.quote[0].insurancePrice} MXN</strong>.`;
            var mailOptions = {
                from: 'BBVA Seguro de Mascotas',
                to: email,
                subject: 'Cotización del Seguro de ' + req.body.quote[0].petName,
                text: textMail,
                html: htmlMail
            };
            transporter.sendMail(mailOptions, function(error, info) {
                if (error){
                    console.log(error);
                } else {
                    console.log("Email sent");
                    res.status(200).jsonp(req.body);
                }
            });
            if (body.length === 1) {
                // cliente ya existe, se agrega nuevo quote
                console.log('CLIENTE ENCONTRADO');
                let existClient = body[0];
                existClient.quote.push(req.body.quote[0]);
                let clienteMLab = requestjson.createClient(urlClients + "&" + query);
                clienteMLab.put('', existClient, function(err, resM, body) {
                    if (!err) {
                        res.status(200).send(body);
                    } else {
                        res.status(404).send('No se pudo registrar la cotización');
                    }
                });
            } else {
                //cliente no existe, se agrega completo
                console.log('CLIENTE NO ENCONTRADO');
                var newClient = req.body;
                let clienteMLab = requestjson.createClient(urlClients);
                clienteMLab.post(urlClients, newClient, function(err, resM, body) {
                    if (!err) {
                        res.status(200).send(body);
                    } else {
                        res.status(404).send('No se pudo registrar al cliente');
                    }
                });
            }
        } else {
            res.status(404).send('GET ERROR');
        }
    })
});

// GET QUOTES OF CLIENT
app.post('/Quotes', function(req, res) {
    res.set("Access-Control-Allow-Headers", "Content-type");
    var email = req.body.email;
    var password = req.body.password;

    var query = 'q={"email":"' + email + '","password":"' + password + '"}';
    var urlClientsAndQuery = urlClients + "&" + query;
    let quotesMLab = requestjson.createClient(urlClientsAndQuery);
    quotesMLab.get('', function(err, resM, body) {
        if (!err) {
            if (body.length === 1) { //login ok
                res.status(200).send(body);
            } else {
                res.status(404).send('Usuario no encontrado. Verifique sus credenciales');
            }
        } else {
            res.status(404).send('Error desconocido');
        }
    })
  });

  // GET INSURANCE-POIS
app.get('/insurance-pois', function(req, res) {
    var q = req.query.q;

    var indexCategory = q.indexOf("category");
    var category = q.slice(indexCategory + 10);
    category = category.replace(/'/g, '"');

    var indexLongitude = q.indexOf("longitude");
    var preLongitude = q.slice(indexLongitude + 11);
    var indexNextAndLongitude = preLongitude.indexOf("AND");
    var longitude = preLongitude.slice(0, indexNextAndLongitude);
    longitude = longitude.replace(/'/g, '');
    longitude = parseFloat(longitude);

    var indexLatitude = q.indexOf("latitude");
    var preLatitude = q.slice(indexLatitude + 10);
    var indexNextAndLatitude = preLatitude.indexOf("AND");
    var latitude = preLatitude.slice(0, indexNextAndLatitude);
    latitude = latitude.replace(/'/g, '');
    latitude = parseFloat(latitude);

    var indexRadius = q.indexOf("radius");
    var preRadius= q.slice(indexRadius + 8);
    var indexNextAndRadius = preRadius.indexOf("AND");
    var radius = preRadius.slice(0, indexNextAndRadius);
    radius = radius.replace(/'/g, '');
    radius = parseFloat(radius);

    var urlPoisAndQuery = urlInsurancePois + '&q={"category":' + category + '}';
    console.log(urlPoisAndQuery);
    var poisMLab = requestjson.createClient(urlPoisAndQuery);
    poisMLab.get('', function(err, resM, body) {
        if (err) {
            res.status(404).send('Error al obtener pois');
        } else {
            let bodyFilter = body.filter(el => getKilometros(latitude,longitude, el.address.geolocation.latitude, el.address.geolocation.longitude) <= radius);

            var data = {
                "data": bodyFilter
            };
            res.status(200).send(data);
        }
    })
  });

function getKilometros(lat1,lon1,lat2,lon2) {
    function rad(x) {
        return x*Math.PI/180;
    }
    var R = 6378.137; //Radio de la tierra en km
    var dLat = rad( lat2 - lat1 );
    var dLong = rad( lon2 - lon1 );
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLong/2) * Math.sin(dLong/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return d.toFixed(3); //Retorna tres decimales
}