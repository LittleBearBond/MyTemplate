(function ($) {
    var dataRegex = /\{[\@\$].+?\}/ig,
        funcs;
    //扩展Jquery实例对象
    $.extend($.fn, {
        BearTemplate: function (opts) {
            var setting = $.extend({}, opts),
                initTemplate = function (templateObj, sets) {
                    var $template = $(templateObj);
                    sets && (funcs = $.extend({}, sets));
                    if (!$template) {
                        return { executeRender: function () { return "模板为空"; } };
                    }
                    var dataItems, //存储要替换的对象
                        templateContent = $template.html().replace(/(^\s*)/g, '').replace(/(\s*)$/g, ''); //模板文本
                    //把编码的替换回来
                    templateContent = templateContent.replace(/%7B/ig, "{").replace(/%7D/ig, "}").replace(/%28/ig, "(").replace(/%29/ig, ")");
                    var tree = next("@name,'Bear'");
                    var tree1 = next("@name,@index");
                    var tree2 = next("$get(@name,@index)");
                    var tree3 = next("$get(@name,@index,'xiongjian')");
                    dataItems = handleDataItem(templateContent);
                    var executeRender = function (data, gData) {
                        var result = templateContent,
                            i = 0,
                            dataItemslen = dataItems.length;
                        data = $.extend(data, gData);
                        //执行相关替换，得到对于的模板
                        //result = executeControl(data, controls, result);
                        for (; i < dataItemslen; i++) {
                            var currItems = dataItems[i], replaceItem = currItems.replaceItem;
                            //处理过后的模板中存在这个键  这里有待优化  每次检查性能肯定有影响
                            if (result.indexOf(replaceItem) >= 0) {
                                //处理Item 取到相关的数据
                                var value = renderData(data, currItems.tree);
                                while (result.indexOf(replaceItem) >= 0) {
                                    result = result.replace(replaceItem, value);
                                }
                            }
                        }
                        return result;
                    };
                    return {
                        executeRender: executeRender
                    };
                };
            return initTemplate(this, setting);
            //处理模板替换对象

            function handleDataItem(templateContent) {
                var match = templateContent.match(dataRegex),
                    dataItems = [],
                    item;
                if (match && match.length) {
                    var i = 0, len = match.length, matchItem;
                    for (; i < len; i++) {
                        //得到要替换的 如{@name}
                        matchItem = match[i];
                        //得到匹配结果 去掉左右的{}得到如：@name
                        item = matchItem.substring(1, matchItem.length - 1);
                        var hasItem = false, j = 0, dataItemsLen = dataItems.length;
                        //判断是否已经处理过该项
                        for (; j < dataItemsLen; j++) {
                            if (item == dataItems[j].item) {
                                hasItem = true;
                                break;
                            }
                        }
                        if (!hasItem) {
                            var tree = next(item.replace(/\s/g, ""));
                            dataItems.push({
                                item: item,
                                replaceItem: matchItem, //new RegExp(replace, "ig"),
                                tree: tree
                            });
                        }
                    }
                }
                return dataItems;
            }

            /*处理参数
              1、@index  处理单个参数
              2、@index,@name,@addr 处理多个
              3、$fromate(@name,@index,'123') 处理函数调用，函数里面有替换参数对象也有常量
              4、'123' 直接是常量
              */

            function next(item, args) {
                if (!item || !item.length) {
                    return args || null;
                }
                var ch = item.charAt(0),
                    tree = args || [];
                switch (ch) {
                    case "$":
                        var func = readFunc(item);
                        //处理得到函数的名字，以及函数的参数args，用于后续的apply
                        tree.push({ type: "function", name: func.name, args: next(func.spare) });
                        break;
                    case "@":
                        var para = readParam(item);
                        tree.push({ type: "param", name: para.name });
                        next(para.spare, tree); //递归处理剩下的
                        break;
                    default:
                        var constPara = readConst(item);
                        tree.push({ type: "const", value: constPara.value });
                        next(constPara.spare, tree); //递归处理剩下的
                        break;
                }
                return tree;
            }

            //读取函数和参数信息

            function readFunc(item) {
                //取得函数的名字
                var funcName = item.substring(1, item.indexOf("(")),
                    //取得剩下的参数部分
                    spare = item.substring(1 + funcName.length + 1, item.length - 1);
                //返回函数名字和剩余的部分
                return {
                    name: funcName,
                    spare: spare
                };
            }

            //读取要替换的参数

            function readParam(item) {
                var index = item.indexOf(","),
                    itemLen = item.length,
                    spare,
                    paramName = index < 0 ? //是否是多个对象  @index,@name
                        item.substring(1, itemLen) : //只是一个,直接取得名字
                        item.substring(1, index); //取得第一个
                spare = index < 0 ?
                    item.substring(1 + paramName.length, itemLen) : //这个只是空
                    item.substring(1 + paramName.length + 1, itemLen); //取得剩下的部分 @name
                return {
                    name: paramName,
                    spare: spare
                };
            }

            //读取常量

            function readConst(item) {
                var index = item.indexOf(","),
                    itemLen = item.length,
                    spare,
                    value = index < 0 ?
                        item.substring(0, itemLen) :
                        item.substring(0, index);
                spare = index < 0 ?
                    item.substring(1 + value.length, itemLen) :
                    item.substring(value.length + 1, itemLen);
                return {
                    value: value,
                    spare: spare
                };
            }

            //执行相关操作，得到处理后的数据

            function renderData(data, tree) {
                var result = "", root;
                root = $.isArray(tree) && tree.length > 0 ? tree[0] : tree;
                if (root == null) {
                    return result;
                }
                switch (root.type) {
                    //如果是函数 就调用并且返回结果
                    case "function":
                        if ($.isFunction(funcs[root.name])) {
                            result = funcs[root.name].apply(data, makeArgs(data, root.args));
                        } else {
                            result = window[root.name].apply(data, makeArgs(data, root.args));
                        }
                        break;
                    case "param":
                        //是参数类型，直接替换
                        result = getDataItem(data, root.name);
                        break;
                    case "const":
                        result = root.value; //常量就直接返回
                        break;
                    default:
                        break;
                }
                return result;
            }

            function makeArgs(data, tree) {
                var args = [], i = 0, len = tree.length;
                if ($.isArray(tree)) {
                    for (; i < len; i++) {
                        args.push(renderData(data, tree[i]));
                    }
                }
                return args;
            }

            //取得数据 不区分键的大小写

            function getDataItem(data, propertyName) {
                for (var p in data) {
                    if (data.hasOwnProperty(p) && p.toString().toUpperCase() == propertyName.toUpperCase()) {
                        return data[p];
                    }
                }
                return propertyName;
            }

        }
    });

})($);