/**
 *
 * 参考：https://bitbucket.org/tkoskine/arduino-pn532/wiki/NFC_Forum_Type_4_tags
 *
 *
 var CLASS;        // 00  -------------------------[0]
 var instruction;  // A4(164)/B0(176)/D6(214) -----[1]
 var param_1;      // 04/00 -----------------------[2]
 var param_2;      // 00/0C(12)/02 ----------------[3]
 var length;       // 0F(15)/02 -------------------[4]
 var param_3;      // E1(225)/D2(210) -------------[5]
 var param_4;      // 03/04/76(118) ---------------[6]
 */
const ndef = require('src/ndef.js');

var status = -1;

var STATUS_ERROR = -1;
var STATUS_SELECT_TAG = 1;    //   instruction == A4 && param_1 == 04
var STATUS_SELECT_FILE = 2;   //   instruction == A4 && param_1 == 00 && param_2 == 0C && length == 02 && param_3 == E1 && param_4 = 03
var STATUS_READ_LENGTH = 3;   //   instruction == B0 && length == 2
var STATUS_READ_BINARY = 4;   //   instruction == B0 && length == 0F
var STATUS_UPDATE_BINARY = 5; //   instruction == A4 && param_1 == 00 && param_2 == 0C && length == 02 && param_3 == E1 && param_4 = 04
var STATUS_READING = 6;       //   instruction == B0 && length == 0F done
var STATUS_DONE = 7;

var read_binary_done = false;
var response = [];

function getTextRecordData(response) {
    var tem = ndef.encodeMessage([ndef.textRecord(response, "", [255, 4])]);
    var data = [0, tem.length + 2];
    for (var i = 0; i < tem.length; i++) {
        data[i + 2] = tem[i];
    }
    return data;
}

function onMessage(message, data) {
    message = new Uint8Array(message);
    switch (message[1]) {
        case 164:
            switch (message[4]) {
                case 4:
                    status = STATUS_SELECT_TAG;
                    break;
                case 0:
                    switch (message[6]) {
                        case 3:
                            status = STATUS_SELECT_FILE;
                            break;
                        case 4:
                            status = STATUS_UPDATE_BINARY;
                            break;
                    }
                    break;
            }
            break;
        case 176:
            if (!read_binary_done) {
                switch (message[4]) {
                    case 2:
                        status = STATUS_READ_LENGTH;
                        read_binary_done = true;
                        break;
                    case 15:
                        status = STATUS_READ_BINARY;
                        read_binary_done = false;
                        break;
                    default :
                        status = STATUS_DONE;
                        break
                }
            } else {
                status = STATUS_READING;
                read_binary_done = false;
            }

            break;
        case 214:
            break;
    }

    switch (status) {
        case STATUS_ERROR:
            response = [106, 130];
            break;
        case STATUS_SELECT_TAG:
            response = [144, 0];
            break;
        case STATUS_SELECT_FILE:
            response = [144, 0];
            break;
        case STATUS_READ_LENGTH:
            response = [0, data.length, 144, 0];
            break;
        case STATUS_READ_BINARY:
            response = [0, 15, 32, 0, 59, 0, 52, 4, 6, 225, 4, 0, data.length + 2, 0, 0, 144, 0];
            break;
        case STATUS_UPDATE_BINARY:
            response = [144, 0];
            break;
        case STATUS_READING:
            var offset = message[4];
            var first = message[3];
            var lastIndex = offset + first;
            var i = 0;
            while (first < lastIndex) {
                response[i] = data[first];
                first++;
                i++;
            }
            response[response.length] = 144;
            response[response.length] = 0;
            break;
        case STATUS_DONE:
            response = [106, 130];
            break;
    }
    return new Uint8Array(response).buffer;
}
