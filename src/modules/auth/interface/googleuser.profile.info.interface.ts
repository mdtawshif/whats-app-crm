/*
    {
	    "id": "101789015317160344902",
	    "email": "milton.cste1101@gmail.com",
	    "verified_email": true,
	    "name": "Md. Milton",
	    "given_name": "Md.",
	    "family_name": "Milton",
	    "picture": "https://lh3.googleusercontent.com/a/ACg8ocJDjSPwSXNoJCVGDXqOGRiepZi45pkWuKEv4bMSXZgDf3xPTrFe=s96-c"
	}
*/
export interface GoogleUserProfileInfo {
  id: string;
  email: string;
  verifiedEmail: boolean;
  name: string;
  givenName: string;
  familyName: string;
  picture: string;
}
