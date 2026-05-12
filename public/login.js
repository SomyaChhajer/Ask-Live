const form = document.querySelector("form");

const emailError = document.querySelector(
  ".email-error"
);

const passwordError = document.querySelector(
  ".password-error"
);


form.addEventListener("submit", async (e) => {

  e.preventDefault();

  // CLEAR OLD ERRORS

  emailError.textContent = "";

  passwordError.textContent = "";


  const email = document.querySelector(
    'input[type="email"]'
  ).value;

  const password = document.querySelector(
    'input[type="password"]'
  ).value;


  // EMPTY CHECK

  if(email === ""){

    emailError.textContent =
      "Please enter email";

    return;

  }

  if(password === ""){

    passwordError.textContent =
      "Please enter password";

    return;

  }


  // LOGIN REQUEST

  const response = await fetch("/login", {

    method:"POST",

    headers:{
      "Content-Type":"application/json"
    },

    body:JSON.stringify({
      email,
      password
    })

  });

  const data = await response.json();


  // SUCCESS

  if(data.success){

    localStorage.setItem(
      "token",
      data.token
    );

    localStorage.setItem(
      "userEmail",
      email
    );

    window.location.href = "/";

  }

  // ERRORS

  else{

    if(data.message === "User not found"){

      emailError.textContent =
        "Email does not exist";

    }

    else if(
      data.message === "Wrong password"
    ){

      passwordError.textContent =
        "Incorrect password";

    }

    else{

      passwordError.textContent =
        data.message;

    }

  }

});