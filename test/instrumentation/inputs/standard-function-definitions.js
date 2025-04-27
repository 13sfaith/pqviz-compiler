function foo() {
    let a = 10
    bar()
}

async function bar() {
    let b = 20
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