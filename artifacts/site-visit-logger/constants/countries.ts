export type Country = {
  name: string;
  code: string; // ISO alpha-2 e.g. 'RW'
  dialCode: string; // e.g. '+250'
  flag: string; // Emoji flag representation
  sampleNumber: string; // Placeholder example
  nationalDigits: number; // Typical national digit length
};

export const SUPPORTED_COUNTRIES: Country[] = [
  {
    "name": "Rwanda",
    "code": "RW",
    "dialCode": "+250",
    "sampleNumber": "788 123 456",
    "nationalDigits": 9,
    "flag": "🇷🇼"
  },
  {
    "name": "Afghanistan",
    "code": "AF",
    "dialCode": "+93",
    "sampleNumber": "70 123 4567",
    "nationalDigits": 9,
    "flag": "🇦🇫"
  },
  {
    "name": "Albania",
    "code": "AL",
    "dialCode": "+355",
    "sampleNumber": "67 123 4567",
    "nationalDigits": 9,
    "flag": "🇦🇱"
  },
  {
    "name": "Algeria",
    "code": "DZ",
    "dialCode": "+213",
    "sampleNumber": "551 234 567",
    "nationalDigits": 9,
    "flag": "🇩🇿"
  },
  {
    "name": "Andorra",
    "code": "AD",
    "dialCode": "+376",
    "sampleNumber": "312 345",
    "nationalDigits": 6,
    "flag": "🇦🇩"
  },
  {
    "name": "Angola",
    "code": "AO",
    "dialCode": "+244",
    "sampleNumber": "923 456 789",
    "nationalDigits": 9,
    "flag": "🇦🇴"
  },
  {
    "name": "Argentina",
    "code": "AR",
    "dialCode": "+54",
    "sampleNumber": "9 11 2345 6789",
    "nationalDigits": 10,
    "flag": "🇦🇷"
  },
  {
    "name": "Armenia",
    "code": "AM",
    "dialCode": "+374",
    "sampleNumber": "77 123 456",
    "nationalDigits": 8,
    "flag": "🇦🇲"
  },
  {
    "name": "Australia",
    "code": "AU",
    "dialCode": "+61",
    "sampleNumber": "412 345 678",
    "nationalDigits": 9,
    "flag": "🇦🇺"
  },
  {
    "name": "Austria",
    "code": "AT",
    "dialCode": "+43",
    "sampleNumber": "664 123 4567",
    "nationalDigits": 10,
    "flag": "🇦🇹"
  },
  {
    "name": "Azerbaijan",
    "code": "AZ",
    "dialCode": "+994",
    "sampleNumber": "50 123 4567",
    "nationalDigits": 9,
    "flag": "🇦🇿"
  },
  {
    "name": "Bahamas",
    "code": "BS",
    "dialCode": "+1-242",
    "sampleNumber": "359 1234",
    "nationalDigits": 7,
    "flag": "🇧🇸"
  },
  {
    "name": "Bahrain",
    "code": "BH",
    "dialCode": "+973",
    "sampleNumber": "3600 1234",
    "nationalDigits": 8,
    "flag": "🇧🇭"
  },
  {
    "name": "Bangladesh",
    "code": "BD",
    "dialCode": "+880",
    "sampleNumber": "1712 345678",
    "nationalDigits": 10,
    "flag": "🇧🇩"
  },
  {
    "name": "Barbados",
    "code": "BB",
    "dialCode": "+1-246",
    "sampleNumber": "260 1234",
    "nationalDigits": 7,
    "flag": "🇧🇧"
  },
  {
    "name": "Belarus",
    "code": "BY",
    "dialCode": "+375",
    "sampleNumber": "29 123 4567",
    "nationalDigits": 9,
    "flag": "🇧🇾"
  },
  {
    "name": "Belgium",
    "code": "BE",
    "dialCode": "+32",
    "sampleNumber": "470 12 34 56",
    "nationalDigits": 9,
    "flag": "🇧🇪"
  },
  {
    "name": "Belize",
    "code": "BZ",
    "dialCode": "+501",
    "sampleNumber": "622 1234",
    "nationalDigits": 7,
    "flag": "🇧🇿"
  },
  {
    "name": "Benin",
    "code": "BJ",
    "dialCode": "+229",
    "sampleNumber": "90 123 456",
    "nationalDigits": 8,
    "flag": "🇧🇯"
  },
  {
    "name": "Bermuda",
    "code": "BM",
    "dialCode": "+1-441",
    "sampleNumber": "500 1234",
    "nationalDigits": 7,
    "flag": "🇧🇲"
  },
  {
    "name": "Bhutan",
    "code": "BT",
    "dialCode": "+975",
    "sampleNumber": "17 12 34 56",
    "nationalDigits": 8,
    "flag": "🇧🇹"
  },
  {
    "name": "Bolivia",
    "code": "BO",
    "dialCode": "+591",
    "sampleNumber": "7123 4567",
    "nationalDigits": 8,
    "flag": "🇧🇴"
  },
  {
    "name": "Bosnia and Herzegovina",
    "code": "BA",
    "dialCode": "+387",
    "sampleNumber": "61 123 456",
    "nationalDigits": 8,
    "flag": "🇧🇦"
  },
  {
    "name": "Botswana",
    "code": "BW",
    "dialCode": "+267",
    "sampleNumber": "71 234 567",
    "nationalDigits": 8,
    "flag": "🇧🇼"
  },
  {
    "name": "Brazil",
    "code": "BR",
    "dialCode": "+55",
    "sampleNumber": "11 91234 5678",
    "nationalDigits": 11,
    "flag": "🇧🇷"
  },
  {
    "name": "Brunei",
    "code": "BN",
    "dialCode": "+673",
    "sampleNumber": "712 3456",
    "nationalDigits": 7,
    "flag": "🇧🇳"
  },
  {
    "name": "Bulgaria",
    "code": "BG",
    "dialCode": "+359",
    "sampleNumber": "87 123 4567",
    "nationalDigits": 9,
    "flag": "🇧🇬"
  },
  {
    "name": "Burkina Faso",
    "code": "BF",
    "dialCode": "+226",
    "sampleNumber": "70 123 456",
    "nationalDigits": 8,
    "flag": "🇧🇫"
  },
  {
    "name": "Burundi",
    "code": "BI",
    "dialCode": "+257",
    "sampleNumber": "79 123 456",
    "nationalDigits": 8,
    "flag": "🇧🇮"
  },
  {
    "name": "Cambodia",
    "code": "KH",
    "dialCode": "+855",
    "sampleNumber": "12 345 678",
    "nationalDigits": 8,
    "flag": "🇰🇭"
  },
  {
    "name": "Cameroon",
    "code": "CM",
    "dialCode": "+237",
    "sampleNumber": "671 234 567",
    "nationalDigits": 9,
    "flag": "🇨🇲"
  },
  {
    "name": "Canada",
    "code": "CA",
    "dialCode": "+1",
    "sampleNumber": "416 555 0123",
    "nationalDigits": 10,
    "flag": "🇨🇦"
  },
  {
    "name": "Cape Verde",
    "code": "CV",
    "dialCode": "+238",
    "sampleNumber": "991 2345",
    "nationalDigits": 7,
    "flag": "🇨🇻"
  },
  {
    "name": "Central African Republic",
    "code": "CF",
    "dialCode": "+236",
    "sampleNumber": "70 123 456",
    "nationalDigits": 8,
    "flag": "🇨🇫"
  },
  {
    "name": "Chad",
    "code": "TD",
    "dialCode": "+235",
    "sampleNumber": "63 123 456",
    "nationalDigits": 8,
    "flag": "🇹🇩"
  },
  {
    "name": "Chile",
    "code": "CL",
    "dialCode": "+56",
    "sampleNumber": "9 1234 5678",
    "nationalDigits": 9,
    "flag": "🇨🇱"
  },
  {
    "name": "China",
    "code": "CN",
    "dialCode": "+86",
    "sampleNumber": "138 0013 8000",
    "nationalDigits": 11,
    "flag": "🇨🇳"
  },
  {
    "name": "Colombia",
    "code": "CO",
    "dialCode": "+57",
    "sampleNumber": "300 123 4567",
    "nationalDigits": 10,
    "flag": "🇨🇴"
  },
  {
    "name": "Comoros",
    "code": "KM",
    "dialCode": "+269",
    "sampleNumber": "321 2345",
    "nationalDigits": 7,
    "flag": "🇰🇲"
  },
  {
    "name": "Congo",
    "code": "CG",
    "dialCode": "+242",
    "sampleNumber": "06 123 4567",
    "nationalDigits": 9,
    "flag": "🇨🇬"
  },
  {
    "name": "Costa Rica",
    "code": "CR",
    "dialCode": "+506",
    "sampleNumber": "8312 3456",
    "nationalDigits": 8,
    "flag": "🇨🇷"
  },
  {
    "name": "Croatia",
    "code": "HR",
    "dialCode": "+385",
    "sampleNumber": "91 123 4567",
    "nationalDigits": 9,
    "flag": "🇭🇷"
  },
  {
    "name": "Cuba",
    "code": "CU",
    "dialCode": "+53",
    "sampleNumber": "5 123 4567",
    "nationalDigits": 8,
    "flag": "🇨🇺"
  },
  {
    "name": "Cyprus",
    "code": "CY",
    "dialCode": "+357",
    "sampleNumber": "96 123 456",
    "nationalDigits": 8,
    "flag": "🇨🇾"
  },
  {
    "name": "Czech Republic",
    "code": "CZ",
    "dialCode": "+420",
    "sampleNumber": "601 123 456",
    "nationalDigits": 9,
    "flag": "🇨🇿"
  },
  {
    "name": "Denmark",
    "code": "DK",
    "dialCode": "+45",
    "sampleNumber": "20 12 34 56",
    "nationalDigits": 8,
    "flag": "🇩🇰"
  },
  {
    "name": "Djibouti",
    "code": "DJ",
    "dialCode": "+253",
    "sampleNumber": "77 123 456",
    "nationalDigits": 8,
    "flag": "🇩🇯"
  },
  {
    "name": "Dominica",
    "code": "DM",
    "dialCode": "+1-767",
    "sampleNumber": "225 1234",
    "nationalDigits": 7,
    "flag": "🇩🇲"
  },
  {
    "name": "Dominican Republic",
    "code": "DO",
    "dialCode": "+1-809",
    "sampleNumber": "234 5678",
    "nationalDigits": 10,
    "flag": "🇩🇴"
  },
  {
    "name": "DR Congo",
    "code": "CD",
    "dialCode": "+243",
    "sampleNumber": "812 345 678",
    "nationalDigits": 9,
    "flag": "🇨🇩"
  },
  {
    "name": "Ecuador",
    "code": "EC",
    "dialCode": "+593",
    "sampleNumber": "99 123 4567",
    "nationalDigits": 9,
    "flag": "🇪🇨"
  },
  {
    "name": "Egypt",
    "code": "EG",
    "dialCode": "+20",
    "sampleNumber": "100 123 4567",
    "nationalDigits": 10,
    "flag": "🇪🇬"
  },
  {
    "name": "El Salvador",
    "code": "SV",
    "dialCode": "+503",
    "sampleNumber": "7012 3456",
    "nationalDigits": 8,
    "flag": "🇸🇻"
  },
  {
    "name": "Equatorial Guinea",
    "code": "GQ",
    "dialCode": "+240",
    "sampleNumber": "222 123 456",
    "nationalDigits": 9,
    "flag": "🇬🇶"
  },
  {
    "name": "Eritrea",
    "code": "ER",
    "dialCode": "+291",
    "sampleNumber": "7 123 456",
    "nationalDigits": 7,
    "flag": "🇪🇷"
  },
  {
    "name": "Estonia",
    "code": "EE",
    "dialCode": "+372",
    "sampleNumber": "5123 4567",
    "nationalDigits": 8,
    "flag": "🇪🇪"
  },
  {
    "name": "Eswatini",
    "code": "SZ",
    "dialCode": "+268",
    "sampleNumber": "7612 3456",
    "nationalDigits": 8,
    "flag": "🇸🇿"
  },
  {
    "name": "Ethiopia",
    "code": "ET",
    "dialCode": "+251",
    "sampleNumber": "91 123 4567",
    "nationalDigits": 9,
    "flag": "🇪🇹"
  },
  {
    "name": "Fiji",
    "code": "FJ",
    "dialCode": "+679",
    "sampleNumber": "701 2345",
    "nationalDigits": 7,
    "flag": "🇫🇯"
  },
  {
    "name": "Finland",
    "code": "FI",
    "dialCode": "+358",
    "sampleNumber": "40 123 4567",
    "nationalDigits": 9,
    "flag": "🇫🇮"
  },
  {
    "name": "France",
    "code": "FR",
    "dialCode": "+33",
    "sampleNumber": "6 12 34 56 78",
    "nationalDigits": 9,
    "flag": "🇫🇷"
  },
  {
    "name": "French Polynesia",
    "code": "PF",
    "dialCode": "+689",
    "sampleNumber": "87 12 34 56",
    "nationalDigits": 8,
    "flag": "🇵🇫"
  },
  {
    "name": "Gabon",
    "code": "GA",
    "dialCode": "+241",
    "sampleNumber": "06 123 456",
    "nationalDigits": 7,
    "flag": "🇬🇦"
  },
  {
    "name": "Gambia",
    "code": "GM",
    "dialCode": "+220",
    "sampleNumber": "991 2345",
    "nationalDigits": 7,
    "flag": "🇬🇲"
  },
  {
    "name": "Georgia",
    "code": "GE",
    "dialCode": "+995",
    "sampleNumber": "595 12 34 56",
    "nationalDigits": 9,
    "flag": "🇬🇪"
  },
  {
    "name": "Germany",
    "code": "DE",
    "dialCode": "+49",
    "sampleNumber": "151 1234 5678",
    "nationalDigits": 10,
    "flag": "🇩🇪"
  },
  {
    "name": "Ghana",
    "code": "GH",
    "dialCode": "+233",
    "sampleNumber": "24 123 4567",
    "nationalDigits": 9,
    "flag": "🇬🇭"
  },
  {
    "name": "Greece",
    "code": "GR",
    "dialCode": "+30",
    "sampleNumber": "691 234 5678",
    "nationalDigits": 10,
    "flag": "🇬🇷"
  },
  {
    "name": "Grenada",
    "code": "GD",
    "dialCode": "+1-473",
    "sampleNumber": "403 1234",
    "nationalDigits": 7,
    "flag": "🇬🇩"
  },
  {
    "name": "Guam",
    "code": "GU",
    "dialCode": "+1-671",
    "sampleNumber": "727 1234",
    "nationalDigits": 7,
    "flag": "🇬🇺"
  },
  {
    "name": "Guatemala",
    "code": "GT",
    "dialCode": "+502",
    "sampleNumber": "5123 4567",
    "nationalDigits": 8,
    "flag": "🇬🇹"
  },
  {
    "name": "Guinea",
    "code": "GN",
    "dialCode": "+224",
    "sampleNumber": "621 123 456",
    "nationalDigits": 9,
    "flag": "🇬🇳"
  },
  {
    "name": "Guinea-Bissau",
    "code": "GW",
    "dialCode": "+245",
    "sampleNumber": "955 123 456",
    "nationalDigits": 9,
    "flag": "🇬🇼"
  },
  {
    "name": "Guyana",
    "code": "GY",
    "dialCode": "+592",
    "sampleNumber": "621 1234",
    "nationalDigits": 7,
    "flag": "🇬🇾"
  },
  {
    "name": "Haiti",
    "code": "HT",
    "dialCode": "+509",
    "sampleNumber": "3412 3456",
    "nationalDigits": 8,
    "flag": "🇭🇹"
  },
  {
    "name": "Honduras",
    "code": "HN",
    "dialCode": "+504",
    "sampleNumber": "9123 4567",
    "nationalDigits": 8,
    "flag": "🇭🇳"
  },
  {
    "name": "Hong Kong",
    "code": "HK",
    "dialCode": "+852",
    "sampleNumber": "5123 4567",
    "nationalDigits": 8,
    "flag": "🇭🇰"
  },
  {
    "name": "Hungary",
    "code": "HU",
    "dialCode": "+36",
    "sampleNumber": "20 123 4567",
    "nationalDigits": 9,
    "flag": "🇭🇺"
  },
  {
    "name": "Iceland",
    "code": "IS",
    "dialCode": "+354",
    "sampleNumber": "611 1234",
    "nationalDigits": 7,
    "flag": "🇮🇸"
  },
  {
    "name": "India",
    "code": "IN",
    "dialCode": "+91",
    "sampleNumber": "98765 43210",
    "nationalDigits": 10,
    "flag": "🇮🇳"
  },
  {
    "name": "Indonesia",
    "code": "ID",
    "dialCode": "+62",
    "sampleNumber": "812 3456 7890",
    "nationalDigits": 10,
    "flag": "🇮🇩"
  },
  {
    "name": "Iran",
    "code": "IR",
    "dialCode": "+98",
    "sampleNumber": "912 345 6789",
    "nationalDigits": 10,
    "flag": "🇮🇷"
  },
  {
    "name": "Iraq",
    "code": "IQ",
    "dialCode": "+964",
    "sampleNumber": "790 123 4567",
    "nationalDigits": 10,
    "flag": "🇮🇶"
  },
  {
    "name": "Ireland",
    "code": "IE",
    "dialCode": "+353",
    "sampleNumber": "85 123 4567",
    "nationalDigits": 9,
    "flag": "🇮🇪"
  },
  {
    "name": "Israel",
    "code": "IL",
    "dialCode": "+972",
    "sampleNumber": "50 123 4567",
    "nationalDigits": 9,
    "flag": "🇮🇱"
  },
  {
    "name": "Italy",
    "code": "IT",
    "dialCode": "+39",
    "sampleNumber": "312 345 6789",
    "nationalDigits": 10,
    "flag": "🇮🇹"
  },
  {
    "name": "Ivory Coast",
    "code": "CI",
    "dialCode": "+225",
    "sampleNumber": "07 1234 5678",
    "nationalDigits": 10,
    "flag": "🇨🇮"
  },
  {
    "name": "Jamaica",
    "code": "JM",
    "dialCode": "+1-876",
    "sampleNumber": "301 1234",
    "nationalDigits": 7,
    "flag": "🇯🇲"
  },
  {
    "name": "Japan",
    "code": "JP",
    "dialCode": "+81",
    "sampleNumber": "90 1234 5678",
    "nationalDigits": 10,
    "flag": "🇯🇵"
  },
  {
    "name": "Jordan",
    "code": "JO",
    "dialCode": "+962",
    "sampleNumber": "7 9012 3456",
    "nationalDigits": 9,
    "flag": "🇯🇴"
  },
  {
    "name": "Kazakhstan",
    "code": "KZ",
    "dialCode": "+7",
    "sampleNumber": "701 123 4567",
    "nationalDigits": 10,
    "flag": "🇰🇿"
  },
  {
    "name": "Kenya",
    "code": "KE",
    "dialCode": "+254",
    "sampleNumber": "712 345 678",
    "nationalDigits": 9,
    "flag": "🇰🇪"
  },
  {
    "name": "Kiribati",
    "code": "KI",
    "dialCode": "+686",
    "sampleNumber": "720 12345",
    "nationalDigits": 8,
    "flag": "🇰🇮"
  },
  {
    "name": "Kosovo",
    "code": "XK",
    "dialCode": "+383",
    "sampleNumber": "44 123 456",
    "nationalDigits": 8,
    "flag": "🇽🇰"
  },
  {
    "name": "Kuwait",
    "code": "KW",
    "dialCode": "+965",
    "sampleNumber": "9012 3456",
    "nationalDigits": 8,
    "flag": "🇰🇼"
  },
  {
    "name": "Kyrgyzstan",
    "code": "KG",
    "dialCode": "+996",
    "sampleNumber": "700 123 456",
    "nationalDigits": 9,
    "flag": "🇰🇬"
  },
  {
    "name": "Laos",
    "code": "LA",
    "dialCode": "+856",
    "sampleNumber": "20 23 123 456",
    "nationalDigits": 10,
    "flag": "🇱🇦"
  },
  {
    "name": "Latvia",
    "code": "LV",
    "dialCode": "+371",
    "sampleNumber": "21 234 567",
    "nationalDigits": 8,
    "flag": "🇱🇻"
  },
  {
    "name": "Lebanon",
    "code": "LB",
    "dialCode": "+961",
    "sampleNumber": "71 123 456",
    "nationalDigits": 8,
    "flag": "🇱🇧"
  },
  {
    "name": "Lesotho",
    "code": "LS",
    "dialCode": "+266",
    "sampleNumber": "5812 3456",
    "nationalDigits": 8,
    "flag": "🇱🇸"
  },
  {
    "name": "Liberia",
    "code": "LR",
    "dialCode": "+231",
    "sampleNumber": "77 123 4567",
    "nationalDigits": 8,
    "flag": "🇱🇷"
  },
  {
    "name": "Libya",
    "code": "LY",
    "dialCode": "+218",
    "sampleNumber": "91 123 4567",
    "nationalDigits": 9,
    "flag": "🇱🇾"
  },
  {
    "name": "Liechtenstein",
    "code": "LI",
    "dialCode": "+423",
    "sampleNumber": "661 2345",
    "nationalDigits": 7,
    "flag": "🇱🇮"
  },
  {
    "name": "Lithuania",
    "code": "LT",
    "dialCode": "+370",
    "sampleNumber": "612 34567",
    "nationalDigits": 8,
    "flag": "🇱🇹"
  },
  {
    "name": "Luxembourg",
    "code": "LU",
    "dialCode": "+352",
    "sampleNumber": "621 123 456",
    "nationalDigits": 9,
    "flag": "🇱🇺"
  },
  {
    "name": "Macau",
    "code": "MO",
    "dialCode": "+853",
    "sampleNumber": "6612 3456",
    "nationalDigits": 8,
    "flag": "🇲🇴"
  },
  {
    "name": "Madagascar",
    "code": "MG",
    "dialCode": "+261",
    "sampleNumber": "32 123 4567",
    "nationalDigits": 9,
    "flag": "🇲🇬"
  },
  {
    "name": "Malawi",
    "code": "MW",
    "dialCode": "+265",
    "sampleNumber": "99 123 4567",
    "nationalDigits": 9,
    "flag": "🇲🇼"
  },
  {
    "name": "Malaysia",
    "code": "MY",
    "dialCode": "+60",
    "sampleNumber": "12 345 6789",
    "nationalDigits": 9,
    "flag": "🇲🇾"
  },
  {
    "name": "Maldives",
    "code": "MV",
    "dialCode": "+960",
    "sampleNumber": "771 2345",
    "nationalDigits": 7,
    "flag": "🇲🇻"
  },
  {
    "name": "Mali",
    "code": "ML",
    "dialCode": "+223",
    "sampleNumber": "65 123 456",
    "nationalDigits": 8,
    "flag": "🇲🇱"
  },
  {
    "name": "Malta",
    "code": "MT",
    "dialCode": "+356",
    "sampleNumber": "9912 3456",
    "nationalDigits": 8,
    "flag": "🇲🇹"
  },
  {
    "name": "Marshall Islands",
    "code": "MH",
    "dialCode": "+692",
    "sampleNumber": "235 1234",
    "nationalDigits": 7,
    "flag": "🇲🇭"
  },
  {
    "name": "Mauritania",
    "code": "MR",
    "dialCode": "+222",
    "sampleNumber": "22 123 456",
    "nationalDigits": 8,
    "flag": "🇲🇷"
  },
  {
    "name": "Mauritius",
    "code": "MU",
    "dialCode": "+230",
    "sampleNumber": "5251 2345",
    "nationalDigits": 8,
    "flag": "🇲🇺"
  },
  {
    "name": "Mexico",
    "code": "MX",
    "dialCode": "+52",
    "sampleNumber": "55 1234 5678",
    "nationalDigits": 10,
    "flag": "🇲🇽"
  },
  {
    "name": "Micronesia",
    "code": "FM",
    "dialCode": "+691",
    "sampleNumber": "920 1234",
    "nationalDigits": 7,
    "flag": "🇫🇲"
  },
  {
    "name": "Moldova",
    "code": "MD",
    "dialCode": "+373",
    "sampleNumber": "68 123 456",
    "nationalDigits": 8,
    "flag": "🇲🇩"
  },
  {
    "name": "Monaco",
    "code": "MC",
    "dialCode": "+377",
    "sampleNumber": "6 12 34 56 78",
    "nationalDigits": 8,
    "flag": "🇲🇨"
  },
  {
    "name": "Mongolia",
    "code": "MN",
    "dialCode": "+976",
    "sampleNumber": "8812 3456",
    "nationalDigits": 8,
    "flag": "🇲🇳"
  },
  {
    "name": "Montenegro",
    "code": "ME",
    "dialCode": "+382",
    "sampleNumber": "67 123 456",
    "nationalDigits": 8,
    "flag": "🇲🇪"
  },
  {
    "name": "Morocco",
    "code": "MA",
    "dialCode": "+212",
    "sampleNumber": "661 234 567",
    "nationalDigits": 9,
    "flag": "🇲🇦"
  },
  {
    "name": "Mozambique",
    "code": "MZ",
    "dialCode": "+258",
    "sampleNumber": "84 123 4567",
    "nationalDigits": 9,
    "flag": "🇲🇿"
  },
  {
    "name": "Myanmar",
    "code": "MM",
    "dialCode": "+95",
    "sampleNumber": "9 212 3456",
    "nationalDigits": 8,
    "flag": "🇲🇲"
  },
  {
    "name": "Namibia",
    "code": "NA",
    "dialCode": "+264",
    "sampleNumber": "81 123 4567",
    "nationalDigits": 9,
    "flag": "🇳🇦"
  },
  {
    "name": "Nauru",
    "code": "NR",
    "dialCode": "+674",
    "sampleNumber": "555 1234",
    "nationalDigits": 7,
    "flag": "🇳🇷"
  },
  {
    "name": "Nepal",
    "code": "NP",
    "dialCode": "+977",
    "sampleNumber": "984 1234567",
    "nationalDigits": 10,
    "flag": "🇳🇵"
  },
  {
    "name": "Netherlands",
    "code": "NL",
    "dialCode": "+31",
    "sampleNumber": "6 1234 5678",
    "nationalDigits": 9,
    "flag": "🇳🇱"
  },
  {
    "name": "New Caledonia",
    "code": "NC",
    "dialCode": "+687",
    "sampleNumber": "75 12 34",
    "nationalDigits": 6,
    "flag": "🇳🇨"
  },
  {
    "name": "New Zealand",
    "code": "NZ",
    "dialCode": "+64",
    "sampleNumber": "21 123 4567",
    "nationalDigits": 9,
    "flag": "🇳🇿"
  },
  {
    "name": "Nicaragua",
    "code": "NI",
    "dialCode": "+505",
    "sampleNumber": "8712 3456",
    "nationalDigits": 8,
    "flag": "🇳🇮"
  },
  {
    "name": "Niger",
    "code": "NE",
    "dialCode": "+227",
    "sampleNumber": "96 123 456",
    "nationalDigits": 8,
    "flag": "🇳🇪"
  },
  {
    "name": "Nigeria",
    "code": "NG",
    "dialCode": "+234",
    "sampleNumber": "802 123 4567",
    "nationalDigits": 10,
    "flag": "🇳🇬"
  },
  {
    "name": "North Korea",
    "code": "KP",
    "dialCode": "+850",
    "sampleNumber": "191 234 5678",
    "nationalDigits": 10,
    "flag": "🇰🇵"
  },
  {
    "name": "North Macedonia",
    "code": "MK",
    "dialCode": "+389",
    "sampleNumber": "72 123 456",
    "nationalDigits": 8,
    "flag": "🇲🇰"
  },
  {
    "name": "Norway",
    "code": "NO",
    "dialCode": "+47",
    "sampleNumber": "412 34 567",
    "nationalDigits": 8,
    "flag": "🇳🇴"
  },
  {
    "name": "Oman",
    "code": "OM",
    "dialCode": "+968",
    "sampleNumber": "9123 4567",
    "nationalDigits": 8,
    "flag": "🇴🇲"
  },
  {
    "name": "Pakistan",
    "code": "PK",
    "dialCode": "+92",
    "sampleNumber": "301 2345678",
    "nationalDigits": 10,
    "flag": "🇵🇰"
  },
  {
    "name": "Palau",
    "code": "PW",
    "dialCode": "+680",
    "sampleNumber": "775 1234",
    "nationalDigits": 7,
    "flag": "🇵🇼"
  },
  {
    "name": "Palestine",
    "code": "PS",
    "dialCode": "+970",
    "sampleNumber": "59 912 3456",
    "nationalDigits": 9,
    "flag": "🇵🇸"
  },
  {
    "name": "Panama",
    "code": "PA",
    "dialCode": "+507",
    "sampleNumber": "6123 4567",
    "nationalDigits": 8,
    "flag": "🇵🇦"
  },
  {
    "name": "Papua New Guinea",
    "code": "PG",
    "dialCode": "+675",
    "sampleNumber": "7012 3456",
    "nationalDigits": 8,
    "flag": "🇵🇬"
  },
  {
    "name": "Paraguay",
    "code": "PY",
    "dialCode": "+595",
    "sampleNumber": "981 123 456",
    "nationalDigits": 9,
    "flag": "🇵🇾"
  },
  {
    "name": "Peru",
    "code": "PE",
    "dialCode": "+51",
    "sampleNumber": "912 345 678",
    "nationalDigits": 9,
    "flag": "🇵🇪"
  },
  {
    "name": "Philippines",
    "code": "PH",
    "dialCode": "+63",
    "sampleNumber": "917 123 4567",
    "nationalDigits": 10,
    "flag": "🇵🇭"
  },
  {
    "name": "Poland",
    "code": "PL",
    "dialCode": "+48",
    "sampleNumber": "512 345 678",
    "nationalDigits": 9,
    "flag": "🇵🇱"
  },
  {
    "name": "Portugal",
    "code": "PT",
    "dialCode": "+351",
    "sampleNumber": "912 345 678",
    "nationalDigits": 9,
    "flag": "🇵🇹"
  },
  {
    "name": "Puerto Rico",
    "code": "PR",
    "dialCode": "+1-787",
    "sampleNumber": "234 5678",
    "nationalDigits": 10,
    "flag": "🇵🇷"
  },
  {
    "name": "Qatar",
    "code": "QA",
    "dialCode": "+974",
    "sampleNumber": "3312 3456",
    "nationalDigits": 8,
    "flag": "🇶🇦"
  },
  {
    "name": "Romania",
    "code": "RO",
    "dialCode": "+40",
    "sampleNumber": "712 345 678",
    "nationalDigits": 9,
    "flag": "🇷🇴"
  },
  {
    "name": "Russia",
    "code": "RU",
    "dialCode": "+7",
    "sampleNumber": "912 345-67-89",
    "nationalDigits": 10,
    "flag": "🇷🇺"
  },
  {
    "name": "Saint Kitts and Nevis",
    "code": "KN",
    "dialCode": "+1-869",
    "sampleNumber": "662 1234",
    "nationalDigits": 7,
    "flag": "🇰🇳"
  },
  {
    "name": "Saint Lucia",
    "code": "LC",
    "dialCode": "+1-758",
    "sampleNumber": "284 1234",
    "nationalDigits": 7,
    "flag": "🇱🇨"
  },
  {
    "name": "Saint Vincent and the Grenadines",
    "code": "VC",
    "dialCode": "+1-784",
    "sampleNumber": "492 1234",
    "nationalDigits": 7,
    "flag": "🇻🇨"
  },
  {
    "name": "Samoa",
    "code": "WS",
    "dialCode": "+685",
    "sampleNumber": "72 12345",
    "nationalDigits": 7,
    "flag": "🇼🇸"
  },
  {
    "name": "San Marino",
    "code": "SM",
    "dialCode": "+378",
    "sampleNumber": "66 123 456",
    "nationalDigits": 8,
    "flag": "🇸🇲"
  },
  {
    "name": "Sao Tome and Principe",
    "code": "ST",
    "dialCode": "+239",
    "sampleNumber": "991 2345",
    "nationalDigits": 7,
    "flag": "🇸🇹"
  },
  {
    "name": "Saudi Arabia",
    "code": "SA",
    "dialCode": "+966",
    "sampleNumber": "50 123 4567",
    "nationalDigits": 9,
    "flag": "🇸🇦"
  },
  {
    "name": "Senegal",
    "code": "SN",
    "dialCode": "+221",
    "sampleNumber": "77 123 4567",
    "nationalDigits": 9,
    "flag": "🇸🇳"
  },
  {
    "name": "Serbia",
    "code": "RS",
    "dialCode": "+381",
    "sampleNumber": "60 123 4567",
    "nationalDigits": 9,
    "flag": "🇷🇸"
  },
  {
    "name": "Seychelles",
    "code": "SC",
    "dialCode": "+248",
    "sampleNumber": "251 2345",
    "nationalDigits": 7,
    "flag": "🇸🇨"
  },
  {
    "name": "Sierra Leone",
    "code": "SL",
    "dialCode": "+232",
    "sampleNumber": "76 123 456",
    "nationalDigits": 8,
    "flag": "🇸🇱"
  },
  {
    "name": "Singapore",
    "code": "SG",
    "dialCode": "+65",
    "sampleNumber": "8123 4567",
    "nationalDigits": 8,
    "flag": "🇸🇬"
  },
  {
    "name": "Slovakia",
    "code": "SK",
    "dialCode": "+421",
    "sampleNumber": "912 345 678",
    "nationalDigits": 9,
    "flag": "🇸🇰"
  },
  {
    "name": "Slovenia",
    "code": "SI",
    "dialCode": "+386",
    "sampleNumber": "31 234 567",
    "nationalDigits": 8,
    "flag": "🇸🇮"
  },
  {
    "name": "Solomon Islands",
    "code": "SB",
    "dialCode": "+677",
    "sampleNumber": "74 12345",
    "nationalDigits": 7,
    "flag": "🇸🇧"
  },
  {
    "name": "Somalia",
    "code": "SO",
    "dialCode": "+252",
    "sampleNumber": "61 123 4567",
    "nationalDigits": 9,
    "flag": "🇸🇴"
  },
  {
    "name": "South Africa",
    "code": "ZA",
    "dialCode": "+27",
    "sampleNumber": "71 123 4567",
    "nationalDigits": 9,
    "flag": "🇿🇦"
  },
  {
    "name": "South Korea",
    "code": "KR",
    "dialCode": "+82",
    "sampleNumber": "10 1234 5678",
    "nationalDigits": 10,
    "flag": "🇰🇷"
  },
  {
    "name": "South Sudan",
    "code": "SS",
    "dialCode": "+211",
    "sampleNumber": "912 345 678",
    "nationalDigits": 9,
    "flag": "🇸🇸"
  },
  {
    "name": "Spain",
    "code": "ES",
    "dialCode": "+34",
    "sampleNumber": "612 34 56 78",
    "nationalDigits": 9,
    "flag": "🇪🇸"
  },
  {
    "name": "Sri Lanka",
    "code": "LK",
    "dialCode": "+94",
    "sampleNumber": "71 234 5678",
    "nationalDigits": 9,
    "flag": "🇱🇰"
  },
  {
    "name": "Sudan",
    "code": "SD",
    "dialCode": "+249",
    "sampleNumber": "91 123 4567",
    "nationalDigits": 9,
    "flag": "🇸🇩"
  },
  {
    "name": "Suriname",
    "code": "SR",
    "dialCode": "+597",
    "sampleNumber": "741 2345",
    "nationalDigits": 7,
    "flag": "🇸🇷"
  },
  {
    "name": "Sweden",
    "code": "SE",
    "dialCode": "+46",
    "sampleNumber": "70 123 45 67",
    "nationalDigits": 9,
    "flag": "🇸🇪"
  },
  {
    "name": "Switzerland",
    "code": "CH",
    "dialCode": "+41",
    "sampleNumber": "78 123 45 67",
    "nationalDigits": 9,
    "flag": "🇨🇭"
  },
  {
    "name": "Syria",
    "code": "SY",
    "dialCode": "+963",
    "sampleNumber": "944 123 456",
    "nationalDigits": 9,
    "flag": "🇸🇾"
  },
  {
    "name": "Taiwan",
    "code": "TW",
    "dialCode": "+886",
    "sampleNumber": "912 345 678",
    "nationalDigits": 9,
    "flag": "🇹🇼"
  },
  {
    "name": "Tajikistan",
    "code": "TJ",
    "dialCode": "+992",
    "sampleNumber": "91 812 3456",
    "nationalDigits": 9,
    "flag": "🇹🇯"
  },
  {
    "name": "Tanzania",
    "code": "TZ",
    "dialCode": "+255",
    "sampleNumber": "712 345 678",
    "nationalDigits": 9,
    "flag": "🇹🇿"
  },
  {
    "name": "Thailand",
    "code": "TH",
    "dialCode": "+66",
    "sampleNumber": "81 234 5678",
    "nationalDigits": 9,
    "flag": "🇹🇭"
  },
  {
    "name": "Timor-Leste",
    "code": "TL",
    "dialCode": "+670",
    "sampleNumber": "7712 3456",
    "nationalDigits": 8,
    "flag": "🇹🇱"
  },
  {
    "name": "Togo",
    "code": "TG",
    "dialCode": "+228",
    "sampleNumber": "90 123 456",
    "nationalDigits": 8,
    "flag": "🇹🇬"
  },
  {
    "name": "Tonga",
    "code": "TO",
    "dialCode": "+676",
    "sampleNumber": "771 2345",
    "nationalDigits": 7,
    "flag": "🇹🇴"
  },
  {
    "name": "Trinidad and Tobago",
    "code": "TT",
    "dialCode": "+1-868",
    "sampleNumber": "301 1234",
    "nationalDigits": 7,
    "flag": "🇹🇹"
  },
  {
    "name": "Tunisia",
    "code": "TN",
    "dialCode": "+216",
    "sampleNumber": "20 123 456",
    "nationalDigits": 8,
    "flag": "🇹🇳"
  },
  {
    "name": "Turkey",
    "code": "TR",
    "dialCode": "+90",
    "sampleNumber": "501 234 5678",
    "nationalDigits": 10,
    "flag": "🇹🇷"
  },
  {
    "name": "Turkmenistan",
    "code": "TM",
    "dialCode": "+993",
    "sampleNumber": "65 123 456",
    "nationalDigits": 8,
    "flag": "🇹🇲"
  },
  {
    "name": "Tuvalu",
    "code": "TV",
    "dialCode": "+688",
    "sampleNumber": "20 123",
    "nationalDigits": 5,
    "flag": "🇹🇻"
  },
  {
    "name": "Uganda",
    "code": "UG",
    "dialCode": "+256",
    "sampleNumber": "712 345 678",
    "nationalDigits": 9,
    "flag": "🇺🇬"
  },
  {
    "name": "Ukraine",
    "code": "UA",
    "dialCode": "+380",
    "sampleNumber": "50 123 4567",
    "nationalDigits": 9,
    "flag": "🇺🇦"
  },
  {
    "name": "United Arab Emirates",
    "code": "AE",
    "dialCode": "+971",
    "sampleNumber": "50 123 4567",
    "nationalDigits": 9,
    "flag": "🇦🇪"
  },
  {
    "name": "United Kingdom",
    "code": "GB",
    "dialCode": "+44",
    "sampleNumber": "7911 123456",
    "nationalDigits": 10,
    "flag": "🇬🇧"
  },
  {
    "name": "United States",
    "code": "US",
    "dialCode": "+1",
    "sampleNumber": "202 555 0123",
    "nationalDigits": 10,
    "flag": "🇺🇸"
  },
  {
    "name": "Uruguay",
    "code": "UY",
    "dialCode": "+598",
    "sampleNumber": "94 123 456",
    "nationalDigits": 8,
    "flag": "🇺🇾"
  },
  {
    "name": "Uzbekistan",
    "code": "UZ",
    "dialCode": "+998",
    "sampleNumber": "90 123 45 67",
    "nationalDigits": 9,
    "flag": "🇺🇿"
  },
  {
    "name": "Vanuatu",
    "code": "VU",
    "dialCode": "+678",
    "sampleNumber": "55 12345",
    "nationalDigits": 7,
    "flag": "🇻🇺"
  },
  {
    "name": "Vatican City",
    "code": "VA",
    "dialCode": "+39",
    "sampleNumber": "06 6981 2345",
    "nationalDigits": 10,
    "flag": "🇻🇦"
  },
  {
    "name": "Venezuela",
    "code": "VE",
    "dialCode": "+58",
    "sampleNumber": "412 123 4567",
    "nationalDigits": 10,
    "flag": "🇻🇪"
  },
  {
    "name": "Vietnam",
    "code": "VN",
    "dialCode": "+84",
    "sampleNumber": "91 234 5678",
    "nationalDigits": 9,
    "flag": "🇻🇳"
  },
  {
    "name": "Yemen",
    "code": "YE",
    "dialCode": "+967",
    "sampleNumber": "71 234 567",
    "nationalDigits": 8,
    "flag": "🇾🇪"
  },
  {
    "name": "Zambia",
    "code": "ZM",
    "dialCode": "+260",
    "sampleNumber": "97 123 4567",
    "nationalDigits": 9,
    "flag": "🇿🇲"
  },
  {
    "name": "Zimbabwe",
    "code": "ZW",
    "dialCode": "+263",
    "sampleNumber": "77 123 4567",
    "nationalDigits": 9,
    "flag": "🇿🇼"
  }
];

export const DEFAULT_COUNTRY = SUPPORTED_COUNTRIES[0]; // Rwanda (+250)
