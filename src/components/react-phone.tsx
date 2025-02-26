import PhoneInput from "react-phone-number-input";
import ptBR from "react-phone-number-input/locale/pt-BR.json";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import { formatPhoneNumber } from "react-phone-number-input";

import { useState } from "react";

export default function ReactPhoneInput() {
  type E164Number = string | undefined;
  const [phone, setPhone] = useState<E164Number>();
  const [phoneac, setPhoneac] = useState("");
  return (
    <>
      <PhoneInput
        required
        labels={ptBR}
        name="phoneraw"
        flags={flags}
        value={phone}
        defaultCountry="BR"
        onChange={setPhone}
      />
      <input type="text" name="intl-phone" value={phone} />
      <input
        type="text"
        name="phoneac"
        value={formatPhoneNumber(phone || "")}
      />
    </>
  );
}
