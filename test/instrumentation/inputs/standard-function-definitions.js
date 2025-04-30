function foo() {
    let a = 10
    bar("hello")
}

async function bar() {
    let b = 20
    let someValue = foo()
}

class BlankSlate {
    inAClass() {
        let c = 30
        this.inAClassButWeirder()
    }

    async inAClassButWeirder() {
        let d = 40
    }
}