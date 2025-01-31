import { notify } from "~/utils/notify/notify";

type DecryptFunction = (_s: string) => Promise<string>;

let CryptoJS = null;

const init = async () => {
  CryptoJS = (await import("crypto-js")).default as any;
};

export const useEncryptor = () => {
  /** 密码本体 */
  const usePasswd = useState<string>("passwd", () => "");
  /** 密码是否正确 */
  const passwdCorrect = useState<boolean>("passwdCurrect", () => false);
  /** 同一个密码只会提示一次错误信息 */
  const incorrectPwd = useState<string>("incorrectPasswd", () => "");

  const encrypt: DecryptFunction = async (s: string) => {
    if (!s) {
      return s;
    }
    try {
      await init();
      return CryptoJS.AES.encrypt(s, usePasswd.value).toString();
    } catch (e) {
      notify({
        type: "error",
        title: "加密失败",
        description: e.toString()
      });
      throw e;
    }
  };
  // 解密操作是异步的，因为CryptoJs只有在使用时才被import。缺点是很多地方要改成await
  const decrypt: DecryptFunction = async (s: string) => {
    if (!s) {
      return s;
    }
    try {
      await init();
      const result = CryptoJS.AES.decrypt(s, usePasswd.value).toString(CryptoJS.enc.Utf8);
      if (result) {
        passwdCorrect.value = true;
        return result;
      }
      throw new Error("密码错误");
    } catch (e) {
      passwdCorrect.value = false;
      if (incorrectPwd.value !== usePasswd.value) {
        incorrectPwd.value = usePasswd.value;
        notify({
          type: "error",
          title: "解密失败: " + usePasswd.value,
          description: e.toString()
        });
      }
      throw e;
    }
  };
  /**
   * 解密是 **一次性操作** ，所以解密成功后就不会再处理，解密失败则会一直监听
   * * 有密码 && 解密成功 -> Gotcha!
   * * 没有密码 || 解密失败 -> 开始监听
   *   * 密码为空，继续监听
   *   * 解密失败，继续监听
   *   * 解密成功，取消监听，Gotcha!
   * @param callback 实际的解密操作
   * @param firstIsFailed 第一次解密失败后的操作
   * @returns 取消监听函数
   */
  const decryptOrWatchToDecrypt = async (
    callback: (_decrypt: DecryptFunction) => Promise<void>,
    firstIsFailed = () => undefined
  ): Promise<() => void> => {
    try {
      if (!usePasswd.value) {
        throw new Error("需要密码");
      }
      await callback(decrypt);
      return () => undefined;
    } catch (e) {
      firstIsFailed();
      const cancel = watch(usePasswd, async (pwd) => {
        if (!pwd) {
          return;
        }
        try {
          await callback(decrypt);
          cancel();
        } catch {}
      });
      return cancel;
    }
  };

  return {
    usePasswd,
    passwdCorrect,
    init,
    encrypt,
    decryptOrWatchToDecrypt
  };
};
