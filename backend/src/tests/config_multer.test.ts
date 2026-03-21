describe("Multer Config Coverage", () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test("post multer creates upload directory when missing", () => {
        const existsSyncMock = jest.fn().mockReturnValue(false);
        const mkdirSyncMock = jest.fn();

        jest.doMock("fs", () => ({
            __esModule: true,
            default: {
                existsSync: existsSyncMock,
                mkdirSync: mkdirSyncMock,
            },
            existsSync: existsSyncMock,
            mkdirSync: mkdirSyncMock,
        }));

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../config/post_multer_config");

        expect(existsSyncMock).toHaveBeenCalled();
        expect(mkdirSyncMock).toHaveBeenCalled();
    });

    test("profile multer creates upload directory when missing", () => {
        const existsSyncMock = jest.fn().mockReturnValue(false);
        const mkdirSyncMock = jest.fn();

        jest.doMock("fs", () => ({
            __esModule: true,
            default: {
                existsSync: existsSyncMock,
                mkdirSync: mkdirSyncMock,
            },
            existsSync: existsSyncMock,
            mkdirSync: mkdirSyncMock,
        }));

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../config/multer_config");

        expect(existsSyncMock).toHaveBeenCalled();
        expect(mkdirSyncMock).toHaveBeenCalled();
    });
});
