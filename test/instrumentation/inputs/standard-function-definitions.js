function foo() {
    let a = 10
    bar(a)
}

async function bar(val) {
    console.log("hello: ", val)
}

foo()