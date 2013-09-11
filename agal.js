/**
 * Created with IntelliJ IDEA.
 * User: shanemc
 * Date: 9/11/13
 * Time: 9:16 AM
 * To change this template use File | Settings | File Templates.
 */

var agalRegisters = {};
$(document).ready(function() {
    $('div.input input').change(function() {
        updateView(true);
    });
    updateView(true);

    $('#run').click(function(e) {
        runShader();
    });

    $('#fragment').change(clearOutput);
    $('#fragment').keyup(clearOutput);

    $('#fragment').scroll(function() {
        $('#fragment_result').scrollTop($('#fragment').scrollTop());
    });

    $('#fragment_result').scroll(function() {
        $('#fragment').scrollTop($('#fragment_result').scrollTop());
    });
});

function clearOutput() {
    var shader = $('#fragment').val();
    lines = shader.split("\n");
    var out = '';
    lines.forEach(function() {
        out += "\n";
    });
    $('#fragment_result').val(out);
    $('#fragment_result').scrollTop($('#fragment').scrollTop());
}

function updateView(isInput) {
    var suffix = (isInput ? 'i' : 'o');
    var col = [Math.floor(parseFloat($('#r'+suffix).val()) * 255)];
    col.push(Math.floor(parseFloat($('#g'+suffix).val()) * 255));
    col.push(Math.floor(parseFloat($('#b'+suffix).val()) * 255));
    col.push(parseFloat($('#a'+suffix).val()));
    suffix = (isInput ? 'input' : 'output');
    $('#show_'+suffix+' div').css('background-color', 'rgba(' + col.join(',')+')');
}

function runShader() {
    var ctx = $('#context').val();
    var lines = ctx.split("\n");
    lines.forEach(runContextLine);

    var inputReg = $('#in_reg').val();
    setRegister(inputReg + '.x', parseFloat($('#ri').val()));
    setRegister(inputReg + '.y', parseFloat($('#gi').val()));
    setRegister(inputReg + '.z', parseFloat($('#bi').val()));
    setRegister(inputReg + '.w', parseFloat($('#ai').val()));

    $('#fragment_result').val('');
    var shader = $('#fragment').val();
    lines = shader.split("\n");
    lines.forEach(runShaderLine);

    var outReg = $('#out_reg').val();
    $('#ro').val(getRegister(outReg + '.x'));
    $('#go').val(getRegister(outReg + '.y'));
    $('#bo').val(getRegister(outReg + '.z'));
    $('#ao').val(getRegister(outReg + '.w'));
    updateView(false);
}

function runContextLine(line) {
    var match = /setProgramConstantsFromVector\s*\(.+,\s*(\d)\s*,.+\[([0-9a-zA-Z_,\s\.]+)\]/.exec(line);
    if(match) {
        var regNum = match[1];
        var props = 'xyzw';
        var values = match[2].split(/\s*,\s*/);
        for(var i=0; i<values.length; ++i) {
            setRegister('fc'+regNum+'.'+props.charAt(i), eval(values[i]));
        }
    }
}

function runShaderLine(line) {
    var match = /\s"([0-9a-zA-Z,\s\.]+)/.exec(line);
    if(match) {
        var cmd = /(\w+)\s+([\w0-9\.]+)\s*,\s*([\w0-9\.]+)\s*,?\s*([\w0-9\.]+)?/;
        var cmdMatch = cmd.exec(match[1]);
        if(cmdMatch) {
            var op = cmdMatch[1];
            var dst = cmdMatch[2];
            var src1 = cmdMatch[3];
            var src2 = cmdMatch[4];
            runCmd(op, dst, src1, src2);
        }
        else
            $('#fragment_result').val($('#fragment_result').val() + "\n");
    }
    else
        $('#fragment_result').val($('#fragment_result').val() + "\n");
}

function getRegister(reg) {
    reg = reg.toLowerCase();
    if(reg.indexOf('.') == -1) {
        console.log('Error!  Missing register extension: '+reg);
    }

    var parts = reg.split('.');
    var prop = parts[1];
    reg = parts[0];

    if(!agalRegisters.hasOwnProperty(reg))
        agalRegisters[reg] = {};

    var value = agalRegisters[reg][prop];
    //console.log('READING '+reg+'.'+prop+' = '+value);
    return value;
}

function setRegister(reg, value) {
    reg = reg.toLowerCase();
    if(reg.indexOf('.') == -1) {
        console.log('Error!  Missing register extension: '+reg);
    }

    var parts = reg.split('.');
    var prop = parts[1];
    reg = parts[0];

    if(!agalRegisters.hasOwnProperty(reg))
        agalRegisters[reg] = {};

    //console.log('WRITING '+reg+'.'+prop+' = '+value+'  (was '+agalRegisters[reg][prop]+')');
    agalRegisters[reg][prop] = value;
}

function runCmd(op, dst, src1, src2) {
    // Make sure the operands are the same length
    if(dst.length == src1.length && (!src2 || src2.length == dst.length)) {
        console.log('Command:  op= '+op+'  dst= '+dst+'  src1= '+src1+'  src2= '+src2);
        var DST = getRegisterParts(dst);
        var SRC1 = getRegisterParts(src1);
        var SRC2 = getRegisterParts(src2);
        var propCount = DST.props.length;
        var results =[]
        for(var i=0; i<propCount; ++i) {
            var res = runOp(op, DST.reg+'.'+DST.props.charAt(i),
                SRC1.reg+'.'+SRC1.props.charAt(i),
                SRC2 ? (SRC2.reg+'.'+SRC2.props.charAt(i)) : null);
            results.push(res);
        }
        $('#fragment_result').val($('#fragment_result').val() + dst + ' = '+results.join(',')+"\n");
    }
    else {
        console.log('Error! Malformed command: op= '+op+'  dst= '+dst+'  src1= '+src1+'  src2= '+src2);
        $('#fragment_result').val($('#fragment_result').val() + "ERROR\n");
    }
}

function getRegisterParts(reg) {
    if(reg == null) return null;

    var props = 'xyzw';
    if(reg.indexOf('.') > -1) {
        var parts = reg.split('.');
        reg = parts[0];
        props = parts[1];
    }

    return {reg: reg, props: props};
}

// Operates on individual properties
function runOp(op, dst, src1, src2) {
    var func = (AGAL.hasOwnProperty(op) ? AGAL[op] : Math[op]);
    if(func == null) {
        console.log('Error!  Unknown opcode: '+op);
        return;
    }

    var opResult = func(getRegister(src1), src2 ? getRegister(src2) : null);
    setRegister(dst, opResult);

    return opResult;
}

var AGAL = {
    // Simple math that isn't in the javascript Math library
    add: function(src1, src2) { return (src1 + src2); },
    sub: function(src1, src2) { return (src1 - src2); },
    mul: function(src1, src2) { return (src1 * src2); },
    div: function(src1, src2) { return (src1 / src2); },

    // Saturate and Fraction
    sat: function(src) { return Math.max(0, Math.min(1, src)); },
    frc: function(src) { return src - Math.floor(src); },

    // Condition operations
    seq: function(src1, src2) { return (src1 == src2 ? 1 : 0); },
    sne: function(src1, src2) { return (src1 != src2 ? 1 : 0); },
    sgt: function(src1, src2) { return (src1 > src2 ? 1 : 0); },
    slt: function(src1, src2) { return (src1 < src2 ? 1 : 0); },
    mov: function(src) { return src; }
};